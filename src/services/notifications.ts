/**
 * Local notifications (docs/02 "Notifications" — no push server, nothing leaves the phone).
 * Asks permission at the end of onboarding, schedules the reminder plan the domain computes,
 * opens the right screen when one is tapped, and clears everything on Delete everything.
 */
import * as Notifications from 'expo-notifications';

import type { PlannedReminder } from '@/domain';

/** Reminders show as banners even while Annum is open; no sound, no badge. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** The system prompt (O4c "Turn on reminders"). True when reminders may be shown. */
export async function askForReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

export async function remindersAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** One-off reminders ("Remind me tomorrow") use this id prefix; the plan leaves them alone. */
const ONCE = 'once-';

/** Replace every planned reminder with this plan (no-op without permission). */
export async function scheduleReminders(plan: readonly PlannedReminder[]): Promise<void> {
  if (!(await remindersAllowed())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (!n.identifier.startsWith(ONCE)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  for (const r of plan) {
    const trigger: Notifications.NotificationTriggerInput = r.weekly
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: r.weekly.weekday + 1, // iOS counts Sunday as 1
          hour: r.weekly.hour,
          minute: r.weekly.minute,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(
            Number(r.at!.date.slice(0, 4)),
            Number(r.at!.date.slice(5, 7)) - 1,
            Number(r.at!.date.slice(8, 10)),
            r.at!.hour,
            r.at!.minute,
          ),
        };
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger,
    });
  }
}

/**
 * S6 "Remind me tomorrow": one reminder at 9 AM tomorrow that opens `url`. No amounts in the
 * text (the lock screen may show it). False when reminders are off for Annum.
 */
export async function remindTomorrow(
  key: string,
  content: { title: string; body: string; url: string },
  now: Date = new Date(),
): Promise<boolean> {
  if (!(await askForReminders())) return false;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  await Notifications.scheduleNotificationAsync({
    identifier: `${ONCE}${key}`,
    content: { title: content.title, body: content.body, data: { url: content.url } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return true;
}

/** The screen a tapped reminder opens (from its data), or null. */
const urlOf = (response: Notifications.NotificationResponse | null): string | null => {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
};

/** Calls back with the screen to open whenever a reminder is tapped. */
export function onReminderTapped(open: (url: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = urlOf(r);
    if (url) open(url);
  });
  return () => sub.remove();
}

/** A reminder tapped while Annum wasn't running (cold start), once. */
export function takeLaunchReminder(): string | null {
  const url = urlOf(Notifications.getLastNotificationResponse());
  if (url) Notifications.clearLastNotificationResponse();
  return url;
}

/** Delete everything: scheduled and delivered notifications. */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}

/** Development check (Spikes screen): the ids of the reminders iOS has scheduled. */
export async function scheduledReminderIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => n.identifier).sort();
}
