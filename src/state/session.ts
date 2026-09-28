/**
 * The session: what the app shows at launch, Face ID unlock, saving every change to the
 * encrypted database, and the Settings actions that touch storage (backup, restore, delete).
 * docs/02 "Storage & security".
 */
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { AppState } from 'react-native';

import { REMINDERS_ON, DEFAULT_PREFS } from '@/data/repo';
import {
  databaseExists,
  isOpen,
  openStorage,
  putConnection,
  restoreBackup,
  save,
  wipeStorage,
  writeBackup,
  type OpenResult,
} from '@/data/storage';
import { isLockEnabled, setLockEnabled } from '@/data/secure';
import { localISODate, newAppData, planReminders } from '@/domain';
import { authenticate, type UnlockResult } from '@/services/lock';
import {
  clearAllNotifications,
  onReminderTapped,
  scheduleReminders,
  takeLaunchReminder,
} from '@/services/notifications';

import { resetBankUi } from './bank';
import { relockAfterMs, shouldRelock } from './lock-rules';
import { useOnboarding, type OnboardingDraft } from './onboarding';
import {
  connectionsKeptThroughRestore,
  PERSISTED_KEYS,
  persistedFrom,
  storedFrom,
  type Persisted,
} from './persist';
import { useAppStore } from './store';

const today = () => localISODate(new Date());
const store = () => useAppStore.getState();

/* ---------- launch and unlock ---------- */

/** Decide the first screen: onboarding, the lock, or the app. */
export async function boot(): Promise<void> {
  try {
    if (!databaseExists()) {
      store().setPhase('onboarding');
      return;
    }
    const lock = await isLockEnabled();
    store().setLockEnabled(lock);
    if (lock) {
      store().setPhase('locked');
      return;
    }
    await load(lock);
  } catch {
    // Never leave the app on a blank start: the can't-open screen offers Try again / Restore.
    store().setPhase('blocked', 'cant-open');
  }
}

async function load(lock: boolean): Promise<void> {
  let result: OpenResult;
  try {
    result = await openStorage(false);
  } catch {
    result = { kind: 'cant-open' };
  }
  if (result.kind !== 'ok') {
    store().setPhase('blocked', result.kind);
    return;
  }
  if (!result.stored) {
    store().setPhase('onboarding');
    return;
  }
  store().hydrate(persistedFrom(result.stored, today()), lock);
}

/** S5 "Unlock with Face ID" (allowPasscode false) and E6 "Use passcode" (true). */
export async function unlock(allowPasscode: boolean): Promise<UnlockResult> {
  const result = await authenticate(allowPasscode);
  if (result === 'unlocked' || result === 'no-protection') {
    if (store().loaded) store().setPhase('ready');
    else await load(true);
  }
  return result;
}

/** Screens presented as sheets or modals: they sit above the lock, so locking closes them. */
const SHEETS = new Set([
  'what-if',
  'deposit/[id]/index',
  'deposit/[id]/setup',
  'income/new',
  'settings/number/[key]',
  'settings/export',
  'settings/delete',
  'account/[id]/balance',
  'bill/[id]',
  'transaction/new',
  'bank/connect',
  'pair',
]);

type NavState = { routes: { name: string; state?: NavState }[] };
type RootState = NavState | undefined;
let rootState: () => RootState = () => undefined;

/** The root layout hands over its navigation container, so locking can see what's open. */
export function watchNavigation(getRootState: () => RootState): void {
  rootState = getRootState;
}

/** Lock now (after 5 minutes away): close open sheets (pushed screens stay) under the lock. */
function lockNow(): void {
  // expo-router nests the app's root stack inside its own "__root" route.
  let state = rootState();
  while (state && state.routes.length === 1 && state.routes[0].state) state = state.routes[0].state;
  const routes = state?.routes ?? [];
  let open = 0;
  for (let i = routes.length - 1; i > 0 && SHEETS.has(routes[i].name); i--) open++;
  if (open) router.dismiss(open);
  store().setPhase('locked');
}

/* ---------- saving ---------- */

let timer: ReturnType<typeof setTimeout> | null = null;

/** Save shortly after every change in real mode (debounced; flushed when the app leaves). */
export function startAutosave(): () => void {
  return useAppStore.subscribe((s, prev) => {
    if (s.mode !== 'real' || !s.loaded) return;
    if (!PERSISTED_KEYS.some((k) => s[k] !== prev[k])) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flushSaves(), 250);
  });
}

export async function flushSaves(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const s = store();
  if (s.mode !== 'real' || !s.loaded || !isOpen()) return;
  try {
    await save(storedFrom(s));
    if (store().saveProblem) store().setSaveProblem(false);
  } catch {
    // Never log the data itself. The next change tries again; Today says so meanwhile.
    store().setSaveProblem(true);
  }
}

/** App lifecycle: save on the way out, lock after 5 minutes away, roll the date at midnight. */
export function startLifecycle(): () => void {
  let backgroundedAt: number | null = null;
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'background') {
      backgroundedAt = Date.now();
      void flushSaves();
    }
    if (next === 'active') {
      const s = store();
      if (
        s.mode === 'real' &&
        s.phase === 'ready' &&
        shouldRelock(s.lockEnabled, backgroundedAt, Date.now(), relockAfterMs())
      ) {
        lockNow();
      }
      backgroundedAt = null;
      s.setToday(today());
    }
  });
  return () => sub.remove();
}

/* ---------- reminders (local notifications) ---------- */

let lastPlan = '';
let reminderTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedule the reminder plan again whenever it changes (real data only). */
export function startReminders(): () => void {
  const check = () => {
    const s = store();
    if (s.mode !== 'real' || !s.loaded) return;
    const now = new Date();
    const plan = planReminders(s.data, s.prefs.reminders, s.prefs.showAmountsOnLockScreen, {
      date: localISODate(now),
      hour: now.getHours(),
      minute: now.getMinutes(),
    });
    const json = JSON.stringify(plan);
    if (json === lastPlan) return;
    if (reminderTimer) clearTimeout(reminderTimer);
    reminderTimer = setTimeout(() => {
      lastPlan = json;
      void scheduleReminders(plan).catch(() => {
        lastPlan = ''; // try again with the next change
      });
    }, 1000);
  };
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (s.data !== prev.data || s.prefs !== prev.prefs || s.loaded !== prev.loaded) check();
  });
  return () => {
    unsubscribe();
    if (reminderTimer) clearTimeout(reminderTimer);
  };
}

let pendingLink: string | null = null;

const openLink = (url: string) => {
  // navigate (not push): it switches tabs for /review and /money/taxes.
  if (store().phase === 'ready') router.navigate(url as Parameters<typeof router.navigate>[0]);
  else pendingLink = url; // after unlock
};

/** A tapped reminder opens its screen; if Annum is locked or starting, after that. */
export function startReminderLinks(): () => void {
  const stopTaps = onReminderTapped(openLink);
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (s.phase === 'ready' && prev.phase !== 'ready') {
      const url = pendingLink ?? takeLaunchReminder();
      pendingLink = null;
      if (url) setTimeout(() => router.navigate(url as Parameters<typeof router.navigate>[0]), 0);
    }
  });
  return () => {
    stopTaps();
    unsubscribe();
  };
}

/* ---------- onboarding ---------- */

/** O4c's last tap: build the first-run data, save it encrypted, open Today. */
export async function finishOnboarding(draft: OnboardingDraft): Promise<boolean> {
  const day = today();
  const data = newAppData({
    today: day,
    incomeType: draft.incomeType ?? 'freelance',
    accounts: draft.accounts,
    transactions: draft.transactions,
    bills: draft.bills,
    expectedIncome: draft.invoice ? [draft.invoice] : [],
    ...(draft.paySchedule ? { paySchedule: draft.paySchedule } : {}),
    ...(draft.monthlySpend ? { monthlySpend: draft.monthlySpend } : {}),
  });
  const persisted: Persisted = {
    data,
    prefs: {
      ...DEFAULT_PREFS,
      reminders: draft.reminders ? REMINDERS_ON : DEFAULT_PREFS.reminders,
    },
    deposits: [],
    splits: [],
    reviews: [],
    rules: [],
    deferred: [],
    // A bank connected during setup is already saved; keep it (it can't be made again).
    connections: store().connections,
    reviewStep: 1,
    pendingTransfer: null,
    startedOn: day,
  };
  try {
    const result = await openStorage(true);
    if (result.kind !== 'ok') {
      store().setPhase('blocked', result.kind);
      return false;
    }
    await save(storedFrom(persisted));
    await setLockEnabled(draft.lock);
  } catch {
    return false; // O4c says so; the answers are still on screen to try again
  }
  store().hydrate(persisted, draft.lock);
  useOnboarding.getState().clear();
  return true;
}

/* ---------- Settings: lock, backup, restore, delete ---------- */

/** Settings → Face ID lock. Demo data only flips the switch; it never changes this phone's lock. */
export async function setLock(on: boolean): Promise<void> {
  if (store().mode === 'real') await setLockEnabled(on);
  store().setLockEnabled(on);
}

/** Export all data: an encrypted file through the share sheet, removed from the phone after. */
export async function shareBackup(passphrase: string): Promise<void> {
  await flushSaves();
  const file = await writeBackup(passphrase, today());
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      UTI: 'public.data',
      dialogTitle: 'Export all data',
    });
  } finally {
    if (file.exists) file.delete();
  }
}

export type RestoreOutcome = 'ok' | 'wrong-passphrase' | 'newer' | 'not-a-backup';

/** Import backup: replaces everything on this phone with the file's data. */
export async function restoreFrom(uri: string, passphrase: string): Promise<RestoreOutcome> {
  if (store().phase === 'blocked')
    await wipeStorage(); // the unreadable file has to go first
  else await flushSaves();
  // Bank connections this phone has (in memory, during setup too) that the backup may not.
  const had = store().connections;
  const result = await restoreBackup(uri, passphrase);
  if (result.kind !== 'ok') return result.kind;
  const kept = connectionsKeptThroughRestore(had, result.stored.connections);
  for (const c of kept) await putConnection(c);
  const restored = persistedFrom(result.stored, today());
  store().hydrate(
    { ...restored, connections: [...restored.connections, ...kept] },
    await isLockEnabled(),
  );
  useOnboarding.getState().clear();
  return 'ok';
}

/** S8 Delete everything: database, Keychain, notifications, exported files. Widget snapshot: M8. */
export async function deleteEverything(options: { keepPairing?: boolean } = {}): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  lastPlan = '';
  await wipeStorage(options);
  await clearAllNotifications();
  useOnboarding.getState().clear();
  if (!options.keepPairing) resetBankUi();
  store().reset();
}

/** Development builds: leave the demo scenarios and go back to this phone's own data. */
export async function backToMyData(): Promise<void> {
  store().setPhase('booting');
  useAppStore.setState({ mode: 'real', loaded: false });
  await boot();
}
