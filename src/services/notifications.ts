/**
 * Local notifications (docs/02 "Notifications" — no push server). M5 asks permission at the end
 * of onboarding and clears everything on Delete everything; scheduling arrives in M6.
 */
import * as Notifications from 'expo-notifications';

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

/** Delete everything: scheduled and delivered notifications. */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}
