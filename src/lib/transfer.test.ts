import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { createInitialData } from './storage';
import { decodePayload, decodeText, encodeTransfer, parsePart, TransferCollector } from './transfer';
import type { AppData } from '../types';

function sampleData(items = 4, historyPerTask = 3): AppData {
  const data = createInitialData();
  for (let i = 0; i < items; i++) {
    data.items.push({ id: `item${i}`, name: `كامري ${i}`, icon: '🚗', color: '#2563eb', createdAt: '2026-01-01T00:00:00Z' });
    for (const pt of data.presets[0].tasks) {
      data.tasks.push({
        id: `${pt.id}-${i}`,
        itemId: `item${i}`,
        titleKey: pt.titleKey,
        every: pt.every,
        unit: pt.unit,
        nextDue: '2026-07-01',
        remind: true,
        history: Array.from({ length: historyPerTask }, (_, h) => ({
          id: `h${h}`,
          date: `2026-0${h + 1}-15`,
          note: 'زيت 5W-30، العداد 85,000 كم',
          cost: 120 + h,
        })),
      });
    }
  }
  return data;
}

/** What must survive a transfer: everything except ids and per-phone settings. */
function content(d: AppData) {
  const itemName = new Map(d.items.map((i) => [i.id, i.name]));
  return {
    presets: d.presets,
    items: d.items.map(({ id: _id, ...rest }) => rest),
    tasks: d.tasks.map(({ id: _id, itemId, history, ...rest }) => ({
      ...rest,
      item: itemName.get(itemId),
      history: history.map(({ id: _h, ...h }) => h),
    })),
  };
}

/** Render a QR code to RGBA pixels (4px modules, quiet zone) and scan it back. */
function scanQr(text: string): string | null {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const scale = 4;
  const quiet = 4;
  const n = qr.modules.size;
  const size = (n + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const idx = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = 0;
        }
    }
  return jsQR(pixels, size, size)?.data ?? null;
}

describe('transfer codec', () => {
  it('round-trips data through a single text code', async () => {
    const data = sampleData();
    const [code] = await encodeTransfer(data, Infinity);
    expect(code.startsWith('INAYA1.1.1.')).toBe(true);
    expect(content(await decodeText(code))).toEqual(content(data));
  });

  it('compresses well enough that typical data needs few QR codes', async () => {
    // One car with the full preset and no history fits in a single QR code.
    expect(await encodeTransfer(sampleData(1, 0))).toHaveLength(1);
    // Two cars with three services each still fit in a couple of codes.
    expect((await encodeTransfer(sampleData(2, 3))).length).toBeLessThanOrEqual(3);
  });

  it('keeps edited and custom presets, and preset order', async () => {
    const data = sampleData(1, 0);
    data.presets[1] = { ...data.presets[1], name: 'My garden', tasks: data.presets[1].tasks.slice(0, 2) };
    data.presets.push({ id: 'farm', name: 'Farm', icon: '🐑', color: '#16a34a', tasks: [{ id: 'f', title: 'Feed', every: 1, unit: 'day' }] });
    data.presets = [data.presets[7], ...data.presets.slice(0, 7)];
    const [code] = await encodeTransfer(data, Infinity);
    expect((await decodeText(code)).presets).toEqual(data.presets);
  });

  it('splits into parts that each scan as real QR codes and reassemble in any order', async () => {
    const data = sampleData(6, 4);
    const parts = await encodeTransfer(data);
    expect(parts.length).toBeGreaterThan(1);
    const collector = new TransferCollector();
    for (const part of [...parts].reverse()) {
      const scanned = scanQr(part);
      expect(scanned).toBe(part);
      collector.add(parsePart(scanned!)!);
    }
    expect(collector.complete).toBe(true);
    expect(content(await decodePayload(collector.payload()))).toEqual(content(data));
  });

  it('ignores duplicates, restarts on a different export, reports missing parts', async () => {
    const a = await encodeTransfer(sampleData(6, 4));
    const b = await encodeTransfer(sampleData(1, 0), 50);
    const c = new TransferCollector();
    expect(c.add(parsePart(a[0])!)).toBe(true);
    expect(c.add(parsePart(a[0])!)).toBe(false);
    expect(c.missing()).toEqual(Array.from({ length: a.length - 1 }, (_, i) => i + 2));
    c.add(parsePart(b[1])!);
    expect(c.total).toBe(b.length);
    expect(c.received).toBe(1);
  });

  it('accepts pasted multi-part text and rejects garbage', async () => {
    const data = sampleData(2, 1);
    const parts = await encodeTransfer(data, 300);
    expect(content(await decodeText(parts.join('\n')))).toEqual(content(data));
    expect(parsePart('hello')).toBeNull();
    expect(parsePart('INAYA1.3.2.abc.xyz')).toBeNull();
    await expect(decodeText(parts.slice(1).join(' '))).rejects.toThrow('incomplete');
    await expect(decodeText('INAYA1.1.1.abcde.notvalidpayload')).rejects.toThrow();
  });
});
