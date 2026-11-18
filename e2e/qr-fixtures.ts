import fs from 'node:fs';
import QRCode from 'qrcode';
import type { AppData } from '../src/types';

export /** Build realistic data large enough to need several QR codes. */
function bigData(): AppData {
  const tasks = ['oilChange', 'tireRotation', 'brakeCheck', 'batteryCheck', 'carWash', 'coolant'];
  const data = JSON.parse(
    JSON.stringify({ version: 1, presets: [], items: [], tasks: [], settings: {} }),
  ) as AppData;
  for (let i = 0; i < 6; i++) {
    data.items.push({ id: `i${i}`, name: `Car ${i + 1}`, icon: '🚗', color: '#2563eb', createdAt: '2026-01-01T00:00:00Z' });
    for (const key of tasks)
      data.tasks.push({
        id: `${key}${i}`,
        itemId: `i${i}`,
        titleKey: `task.${key}`,
        every: 6,
        unit: 'month',
        nextDue: '2026-09-01',
        remind: true,
        history: Array.from({ length: 4 }, (_, h) => ({ id: `h${h}`, date: `2026-0${h + 1}-10`, note: `Service ${h} at 8${h},000 km`, cost: 100 + h })),
      });
  }
  return data;
}

/** Write a Y4M video where each QR part is shown for a few frames (Chrome loops it as a fake camera). */
export async function writeQrVideo(parts: string[], file: string) {
  const W = 640;
  const H = 480;
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F4:1 Ip A1:1 C420jpeg\n`);
  const chunks: Buffer[] = [header];
  for (const part of parts) {
    const qr = QRCode.create(part, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    const scale = Math.floor((H - 40) / (n + 8));
    const size = (n + 8) * scale;
    const ox = Math.floor((W - size) / 2);
    const oy = Math.floor((H - size) / 2);
    const y = Buffer.alloc(W * H, 60); // dim grey surroundings
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const my = Math.floor(row / scale) - 4;
        const mx = Math.floor(col / scale) - 4;
        const dark = my >= 0 && mx >= 0 && my < n && mx < n && qr.modules.get(my, mx);
        y[(oy + row) * W + ox + col] = dark ? 16 : 235;
      }
    const uv = Buffer.alloc((W / 2) * (H / 2), 128);
    for (let f = 0; f < 4; f++) chunks.push(Buffer.from('FRAME\n'), y, uv, uv);
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}
