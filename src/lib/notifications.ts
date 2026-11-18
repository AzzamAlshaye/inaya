import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { AppData } from '../types';
import type { I18n } from '../i18n';
import { addInterval, parseISODate, todayISO } from './dates';

export const isNative = () => Capacitor.isNativePlatform();

const MAX_SCHEDULED = 60;

export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false;
  let { display } = await LocalNotifications.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') {
    ({ display } = await LocalNotifications.requestPermissions());
  }
  return display === 'granted';
}

function at(iso: string, hour: number): Date {
  const d = parseISODate(iso);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Re-schedule all reminders from scratch based on current data. */
export async function syncNotifications(data: AppData, i18n: I18n): Promise<void> {
  if (!isNative()) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  const { settings } = data;
  if (!settings.notifications) return;
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') return;

  const now = new Date();
  const today = todayISO();
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const active = data.tasks.filter((t) => t.remind && !t.paused && itemName.has(t.itemId));

  const upcoming = active
    .map((t) => ({ t, when: at(t.nextDue, settings.reminderHour) }))
    .filter(({ when }) => when > now)
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, MAX_SCHEDULED);

  const notifications = upcoming.map(({ t, when }, idx) => ({
    id: idx + 1,
    title: i18n.t('notif.dueTitle', { item: itemName.get(t.itemId)!, task: i18n.taskTitle(t) }),
    body: i18n.t('notif.dueBody'),
    schedule: { at: when, allowWhileIdle: true },
    extra: { itemId: t.itemId, taskId: t.id },
  }));

  // One daily nudge about overdue tasks (next reminder time).
  const overdue = active.filter((t) => t.nextDue < today).length;
  if (overdue > 0) {
    let when = at(today, settings.reminderHour);
    if (when <= now) when = at(addInterval(today, 1, 'day'), settings.reminderHour);
    notifications.push({
      id: 9999,
      title: i18n.t('notif.overdueTitle'),
      body: i18n.t('notif.overdueBody', { n: overdue }),
      schedule: { at: when, allowWhileIdle: true },
      extra: { itemId: '', taskId: '' },
    });
  }

  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
