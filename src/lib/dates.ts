import type { IntervalUnit, Task, TaskStatus } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse YYYY-MM-DD as a local date (noon avoids DST edge cases). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/** Add an interval, clamping month ends (Jan 31 + 1 month = Feb 28/29). */
export function addInterval(iso: string, every: number, unit: IntervalUnit): string {
  const d = parseISODate(iso);
  const n = Math.max(1, Math.round(every));
  switch (unit) {
    case 'day':
      d.setDate(d.getDate() + n);
      break;
    case 'week':
      d.setDate(d.getDate() + n * 7);
      break;
    case 'month':
    case 'year': {
      const months = unit === 'month' ? n : n * 12;
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + months);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      break;
    }
  }
  return toISODate(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function taskStatus(task: Task, dueSoonDays: number, today = todayISO()): TaskStatus {
  if (task.paused) return 'paused';
  const diff = daysBetween(today, task.nextDue);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= dueSoonDays) return 'soon';
  return 'ok';
}

export function lastDone(task: Task): string | undefined {
  let latest: string | undefined;
  for (const h of task.history) if (!latest || h.date > latest) latest = h.date;
  return latest;
}

const statusOrder: Record<TaskStatus, number> = { overdue: 0, today: 1, soon: 2, ok: 3, paused: 4 };

export function compareTasks(a: Task, b: Task, dueSoonDays: number): number {
  const sa = statusOrder[taskStatus(a, dueSoonDays)];
  const sb = statusOrder[taskStatus(b, dueSoonDays)];
  if (sa !== sb) return sa - sb;
  return a.nextDue.localeCompare(b.nextDue);
}
