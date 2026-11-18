import type { AppData, Preset } from '../types';
import { createInitialData, normalizeData } from './storage';
import { DEFAULT_PRESETS } from '../data/presets';

/**
 * Transfer format for moving data between devices by QR code or text code.
 *
 *   INAYA1.<part>.<total>.<id>.<payload>
 *
 * payload = base64url( deflate-raw( JSON ) ), split into `total` parts.
 * `id` ties the parts of one export together so scans from different
 * exports are never mixed.
 */
const PREFIX = 'INAYA1';
/** Characters of payload per QR code; small enough to scan easily from a screen. */
export const QR_CHUNK = 700;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 7);
}

/**
 * Shrink data before compression: built-in presets the user never changed are
 * sent by id only, settings stay on each phone, and long random ids are
 * renumbered to short ones (safe because an import replaces everything).
 */
interface Compact {
  items: AppData['items'];
  tasks: AppData['tasks'];
  /** Preset ids in order; full objects only for changed/custom presets. */
  presetOrder: string[];
  presets: Preset[];
}

function compact(data: AppData): Compact {
  const short = new Map<string, string>();
  const id = (long: string, prefix: string) => {
    if (!short.has(long)) short.set(long, prefix + short.size.toString(36));
    return short.get(long)!;
  };
  const isDefault = (p: Preset) => {
    const d = DEFAULT_PRESETS.find((x) => x.id === p.id);
    return !!d && JSON.stringify(d) === JSON.stringify(p);
  };
  return {
    items: data.items.map((i) => ({ ...i, id: id(i.id, 'i') })),
    tasks: data.tasks.map((t) => ({
      ...t,
      id: id(t.id, 't'),
      itemId: id(t.itemId, 'i'),
      history: t.history.map((h, n) => ({ ...h, id: n.toString(36) })),
    })),
    presetOrder: data.presets.map((p) => p.id),
    presets: data.presets.filter((p) => !isDefault(p)),
  };
}

function expand(c: Compact): AppData {
  const presets = c.presetOrder
    .map((pid) => c.presets.find((p) => p.id === pid) ?? DEFAULT_PRESETS.find((p) => p.id === pid))
    .filter((p): p is Preset => !!p)
    .map((p) => structuredClone(p));
  return normalizeData({ ...createInitialData(), items: c.items, tasks: c.tasks, presets });
}

/** Encode data into transfer parts. `chunk = Infinity` gives one text code. */
export async function encodeTransfer(data: AppData, chunk = QR_CHUNK): Promise<string[]> {
  const json = JSON.stringify(compact(data));
  const payload = toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
  const total = Math.max(1, Math.ceil(payload.length / chunk));
  const id = randomId();
  return Array.from({ length: total }, (_, i) =>
    [PREFIX, i + 1, total, id, payload.slice(i * chunk, (i + 1) * chunk)].join('.'),
  );
}

export interface TransferPart {
  part: number;
  total: number;
  id: string;
  payload: string;
}

/** Parse one scanned/pasted part; returns null for anything that is not ours. */
export function parsePart(text: string): TransferPart | null {
  const m = /^INAYA1\.(\d+)\.(\d+)\.([a-z0-9]+)\.([A-Za-z0-9_-]*)$/.exec(text.trim().replace(/\s+/g, ''));
  if (!m) return null;
  const part = Number(m[1]);
  const total = Number(m[2]);
  if (!(part >= 1 && part <= total && total <= 500)) return null;
  return { part, total, id: m[3], payload: m[4] };
}

/** Collects parts (in any order) until a full export is available. */
export class TransferCollector {
  private id: string | null = null;
  private parts = new Map<number, string>();
  total = 0;

  /** Returns true when the part was new. Parts from a different export restart collection. */
  add(p: TransferPart): boolean {
    if (this.id !== p.id) {
      this.id = p.id;
      this.total = p.total;
      this.parts.clear();
    }
    if (this.parts.has(p.part)) return false;
    this.parts.set(p.part, p.payload);
    return true;
  }

  get received(): number {
    return this.parts.size;
  }

  get complete(): boolean {
    return this.total > 0 && this.parts.size === this.total;
  }

  missing(): number[] {
    return Array.from({ length: this.total }, (_, i) => i + 1).filter((n) => !this.parts.has(n));
  }

  payload(): string {
    return Array.from({ length: this.total }, (_, i) => this.parts.get(i + 1) ?? '').join('');
  }
}

export async function decodePayload(payload: string): Promise<AppData> {
  const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Compact;
  if (!parsed || !Array.isArray(parsed.presetOrder)) throw new Error('invalid');
  return expand(parsed);
}

/** Decode pasted text that may contain one or many parts (one per line or space-separated). */
export async function decodeText(text: string): Promise<AppData> {
  const collector = new TransferCollector();
  for (const token of text.split(/\s+/)) {
    const p = parsePart(token);
    if (p) collector.add(p);
  }
  if (!collector.complete) throw new Error('incomplete');
  return decodePayload(collector.payload());
}
