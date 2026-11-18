import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppData } from '../types';
import { isNative } from './notifications';
import { normalizeData } from './storage';
import { todayISO } from './dates';

export async function exportBackup(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const fileName = `inaya-backup-${todayISO()}.json`;
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: fileName, files: [uri] });
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackup(file: File): Promise<AppData> {
  const text = await file.text();
  return normalizeData(JSON.parse(text));
}
