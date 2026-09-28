/**
 * Background refresh (docs/02): iOS decides when, at most every few hours. Annum syncs only if
 * its data is already in memory (the app was suspended, not closed): the database key is
 * readable only while the iPhone is unlocked, and a cold start in the background mustn't get
 * around the Face ID lock. Otherwise it waits for the next open. Never throws, never logs.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

const TASK = 'annum-bank-refresh';

/** Set by the app once it can sync (state/bank.ts), so this file stays free of app state. */
let refresh: (() => Promise<void>) | null = null;

export function setBackgroundRefresh(fn: () => Promise<void>): void {
  refresh = fn;
}

TaskManager.defineTask(TASK, async () => {
  try {
    await refresh?.();
  } catch {
    // Nothing to report: the next open syncs as usual.
  }
  return BackgroundTask.BackgroundTaskResult.Success;
});

/** Ask iOS for background time about every 6 hours (it may give less). */
export async function registerBackgroundRefresh(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 6 * 60 });
    }
  } catch {
    // Background refresh is a bonus; the app syncs on open regardless.
  }
}
