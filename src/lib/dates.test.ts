import { describe, expect, it } from 'vitest';
import { addInterval, daysBetween, taskStatus } from './dates';
import type { Task } from '../types';

const task = (nextDue: string, extra: Partial<Task> = {}): Task => ({
  id: 't',
  itemId: 'i',
  every: 1,
  unit: 'month',
  nextDue,
  remind: true,
  history: [],
  ...extra,
});

describe('addInterval', () => {
  it('adds days and weeks', () => {
    expect(addInterval('2026-01-30', 3, 'day')).toBe('2026-02-02');
    expect(addInterval('2026-01-01', 2, 'week')).toBe('2026-01-15');
  });
  it('clamps month ends', () => {
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28');
    expect(addInterval('2028-01-31', 1, 'month')).toBe('2028-02-29');
    expect(addInterval('2026-08-31', 6, 'month')).toBe('2027-02-28');
  });
  it('adds years including leap days', () => {
    expect(addInterval('2028-02-29', 1, 'year')).toBe('2029-02-28');
    expect(addInterval('2026-05-10', 2, 'year')).toBe('2028-05-10');
  });
});

describe('daysBetween', () => {
  it('counts across DST and month boundaries', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-04-01', '2026-03-01')).toBe(-31);
  });
});

describe('taskStatus', () => {
  const today = '2026-06-15';
  it('classifies by due date', () => {
    expect(taskStatus(task('2026-06-14'), 7, today)).toBe('overdue');
    expect(taskStatus(task('2026-06-15'), 7, today)).toBe('today');
    expect(taskStatus(task('2026-06-22'), 7, today)).toBe('soon');
    expect(taskStatus(task('2026-06-23'), 7, today)).toBe('ok');
    expect(taskStatus(task('2026-06-01', { paused: true }), 7, today)).toBe('paused');
  });
});
