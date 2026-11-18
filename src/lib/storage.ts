import { Preferences } from '@capacitor/preferences';
import type { AppData, Settings } from '../types';
import { DEFAULT_PRESETS } from '../data/presets';

const KEY = 'inaya:data';

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  theme: 'auto',
  textScale: 1,
  dueSoonDays: 7,
  notifications: true,
  reminderHour: 9,
  highContrast: false,
  reduceMotion: false,
};

export function createInitialData(): AppData {
  return {
    version: 1,
    presets: structuredClone(DEFAULT_PRESETS),
    items: [],
    tasks: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Validate and fill defaults for data loaded from storage or a backup file. */
export function normalizeData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('invalid');
  const d = raw as Partial<AppData>;
  if (d.version !== 1 || !Array.isArray(d.items) || !Array.isArray(d.tasks)) throw new Error('invalid');
  return {
    version: 1,
    presets: Array.isArray(d.presets) ? d.presets : structuredClone(DEFAULT_PRESETS),
    items: d.items.filter((i) => i && typeof i.id === 'string' && typeof i.name === 'string'),
    tasks: d.tasks
      .filter((t) => t && typeof t.id === 'string' && typeof t.nextDue === 'string')
      .map((t) => ({ ...t, history: Array.isArray(t.history) ? t.history : [] })),
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
  };
}

export async function loadData(): Promise<AppData> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return normalizeData(JSON.parse(value));
  } catch (err) {
    console.error('Failed to load data, starting fresh', err);
  }
  return createInitialData();
}

export async function saveData(data: AppData): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(data) });
}
