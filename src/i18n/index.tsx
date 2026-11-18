import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { ar } from './ar';
import type { IntervalUnit, Preset, PresetTask, Task } from '../types';
import { daysBetween, parseISODate, todayISO } from '../lib/dates';

export type Lang = 'ar' | 'en';
const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, ar };

export function resolveLang(code: string | undefined | null): Lang {
  return code && code.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

type Vars = Record<string, string | number>;

export interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: TranslationKey, vars?: Vars) => string;
  formatDate: (iso: string, style?: 'long' | 'medium') => string;
  formatNumber: (n: number) => string;
  formatRelative: (iso: string) => string;
  formatInterval: (every: number, unit: IntervalUnit) => string;
  taskTitle: (task: Pick<Task | PresetTask, 'title' | 'titleKey'>) => string;
  presetName: (preset: Pick<Preset, 'name' | 'nameKey'>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function interpolate(s: string, vars?: Vars, nf?: Intl.NumberFormat): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === 'number' && nf ? nf.format(v) : String(v);
  });
}

export function createI18n(lang: Lang): I18n {
  const dict = dictionaries[lang];
  const locale = lang === 'ar' ? 'ar-u-ca-gregory' : 'en';
  const nf = new Intl.NumberFormat(locale);
  const dfLong = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const dfMed = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const t = (key: TranslationKey, vars?: Vars) => interpolate(dict[key] ?? en[key] ?? key, vars, nf);
  const lookup = (key: string | undefined) =>
    key && key in dict ? dict[key as TranslationKey] : undefined;

  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    t,
    formatNumber: (n) => nf.format(n),
    formatDate: (iso, style = 'medium') => (style === 'long' ? dfLong : dfMed).format(parseISODate(iso)),
    formatRelative: (iso) => {
      const days = daysBetween(todayISO(), iso);
      const abs = Math.abs(days);
      if (abs < 14) return rtf.format(days, 'day');
      if (abs < 60) return rtf.format(Math.round(days / 7), 'week');
      if (abs < 730) return rtf.format(Math.round(days / 30.44), 'month');
      return rtf.format(Math.round(days / 365.25), 'year');
    },
    formatInterval: (every, unit) => {
      if (every === 1) return t(`every.${unit}` as TranslationKey);
      const amount = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(every);
      return t('everyN', { n: amount });
    },
    taskTitle: (task) => task.title?.trim() || lookup(task.titleKey) || '—',
    presetName: (preset) => preset.name?.trim() || lookup(preset.nameKey) || '—',
  };
}

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => createI18n(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
