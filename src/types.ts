export type IntervalUnit = 'day' | 'week' | 'month' | 'year';

/** A task template inside a preset (e.g. "Oil change every 6 months"). */
export interface PresetTask {
  id: string;
  /** Translation key for built-in tasks; ignored when `title` is set. */
  titleKey?: string;
  title?: string;
  every: number;
  unit: IntervalUnit;
}

/** A category template such as Car, Garden or Home. */
export interface Preset {
  id: string;
  nameKey?: string;
  name?: string;
  icon: string;
  color: string;
  tasks: PresetTask[];
  builtIn?: boolean;
}

/** A tracked thing, e.g. "Toyota Camry" or "Front garden". */
export interface Item {
  id: string;
  name: string;
  presetId?: string;
  icon: string;
  color: string;
  notes?: string;
  /** When tracking starts (YYYY-MM-DD); may be in the past or the future. */
  startDate?: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  note?: string;
  cost?: number;
}

export interface Task {
  id: string;
  itemId: string;
  titleKey?: string;
  title?: string;
  every: number;
  unit: IntervalUnit;
  /** ISO date, YYYY-MM-DD */
  nextDue: string;
  notes?: string;
  remind: boolean;
  paused?: boolean;
  history: LogEntry[];
}

export type LanguageSetting = 'auto' | 'ar' | 'en';
export type ThemeSetting = 'auto' | 'light' | 'dark';

export interface Settings {
  language: LanguageSetting;
  theme: ThemeSetting;
  textScale: number;
  dueSoonDays: number;
  notifications: boolean;
  reminderHour: number;
  highContrast: boolean;
  reduceMotion: boolean;
}

export interface AppData {
  version: 1;
  presets: Preset[];
  items: Item[];
  tasks: Task[];
  settings: Settings;
}

export type TaskStatus = 'overdue' | 'today' | 'soon' | 'ok' | 'paused';
