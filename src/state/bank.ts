/**
 * Bank connections (M7, docs/02 "Bank data"): connecting through Plaid Link, repairing in
 * update mode, and syncing through the Worker. Screens call these; money math stays in the
 * domain. Plaid's Trial allows 10 connections for life, so a connection is saved to the
 * encrypted database the moment Link succeeds, before anything else can go wrong.
 */
import Constants from 'expo-constants';
import { AppState } from 'react-native';
import { create } from 'zustand';

import {
  workerClient,
  WorkerError,
  type PlaidEnv,
  type WorkerClient,
  type WorkerProblem,
  type WorkerStatus,
} from '@/data/plaid/client';
import { mapAccount, problemOf } from '@/data/plaid/map';
import type { BankConnection } from '@/data/repo';
import { getOrCreatePlaidUserId, readWorkerKey, saveWorkerKey } from '@/data/secure';
import { deleteConnection, loadConnections, putConnection } from '@/data/storage';
import { reviewWeekStart, type Account } from '@/domain';
import { registerBackgroundRefresh, setBackgroundRefresh } from '@/services/background';
import { openPlaidLink, type LinkResult } from '@/services/plaid-link';

import { useOnboarding } from './onboarding';
import { localDateTime, useAppStore } from './store';

/** Development builds use Plaid's Sandbox (fake banks, free); TestFlight builds use real banks. */
export const PLAID_ENV: PlaidEnv = __DEV__ ? 'sandbox' : 'production';
const WORKER_URL =
  (Constants.expoConfig?.extra as { workerUrl?: string } | undefined)?.workerUrl ?? '';

/** Sync on open when the last one is older than this (docs/02). */
export const SYNC_AFTER_MS = 6 * 60 * 60 * 1000;
/** Plaid's public token lives 30 minutes: an unfinished connection can be finished until then. */
const PUBLIC_TOKEN_MS = 30 * 60 * 1000;

/**
 * How this phone stands with the Worker: paired, not paired yet, or its key was replaced
 * (a lost phone; scan the new code). Not saved: asked again at every launch.
 */
export type Access = 'unknown' | 'paired' | 'not-paired' | 'key-refused';

export interface BankUi {
  access: Access;
  syncing: boolean;
  offline: boolean;
  /** The shared count ("7 of 10 left"), as last heard from the Worker. */
  count: WorkerStatus | null;
}

export const useBank = create<BankUi>(() => ({
  access: 'unknown',
  syncing: false,
  offline: false,
  count: null,
}));

let client: WorkerClient = workerClient({
  baseUrl: WORKER_URL,
  getKey: readWorkerKey,
  env: PLAID_ENV,
});
let link: (token: string) => Promise<LinkResult> = openPlaidLink;
let wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** The pause before trying an unfinished connection again in the background. */
let later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Tests: a fake Worker, a fake Link, no waiting (`later`: when background retries run). */
export function setBankTestDoubles(doubles: {
  client?: WorkerClient;
  link?: (token: string) => Promise<LinkResult>;
  wait?: (ms: number) => Promise<void>;
  later?: (ms: number) => Promise<void>;
}): void {
  if (doubles.client) client = doubles.client;
  if (doubles.link) link = doubles.link;
  if (doubles.wait) wait = doubles.wait;
  if (doubles.later) later = doubles.later;
}

const app = () => useAppStore.getState();

/** Remember what a Worker problem says about this phone; returns the problem's name. */
function noted(e: unknown): WorkerProblem | 'unknown' {
  if (!(e instanceof WorkerError)) return 'unknown';
  if (e.problem === 'not-paired') useBank.setState({ access: 'not-paired' });
  if (e.problem === 'key-refused') useBank.setState({ access: 'key-refused' });
  if (e.problem === 'offline') useBank.setState({ offline: true });
  return e.problem;
}
const reached = () => useBank.setState({ access: 'paired', offline: false });
/** Plaid's error code (a label like ITEM_LOGIN_REQUIRED, never a token), when there is one. */
const plaidCode = (e: unknown): { code?: string } =>
  e instanceof WorkerError && e.plaid
    ? {
        code: __DEV__
          ? `${e.plaid.error_code}: ${e.plaid.error_message ?? ''}`.trim()
          : e.plaid.error_code,
      }
    : {};

/* ---------- the shared count ---------- */

export type CountCheck =
  { kind: 'ok'; status: WorkerStatus } | { kind: 'problem'; problem: WorkerProblem | 'unknown' };

/** Ask the Worker for the count (always fresh: the other phone may have used one). */
export async function checkCount(): Promise<CountCheck> {
  try {
    const status = await client.status();
    reached();
    useBank.setState({ count: status });
    return { kind: 'ok', status };
  } catch (e) {
    return { kind: 'problem', problem: noted(e) };
  }
}

/** Connections left for a new connection in this build (Sandbox ones are free). */
export const leftFor = (status: WorkerStatus): number =>
  PLAID_ENV === 'sandbox' ? status.limit : status.left;

/* ---------- connecting ---------- */

export type ConnectOutcome =
  | { kind: 'connected'; institution: string; transactions: number }
  | { kind: 'repaired'; institution: string }
  /** E4: Link was closed or failed. Nothing was saved and no connection was used. */
  | { kind: 'didnt-connect' }
  /** Before Link opened (no connection used): not paired, offline, none left… `code`: Plaid's. */
  | { kind: 'problem'; problem: WorkerProblem | 'unknown'; code?: string }
  /** Link finished but saving it didn't (offline): Annum finishes it when it can. */
  | { kind: 'finish-later'; institution: string };

async function keep(c: BankConnection): Promise<void> {
  app().saveConnection(c);
  await putConnection(c);
}

async function forget(c: BankConnection): Promise<void> {
  app().removeConnection(c.itemId);
  await deleteConnection(c.itemId);
}

/**
 * A new connection: link token → Plaid Link → save → exchange → first sync. `skipLink` (Sandbox
 * only) makes a test connection without Link's screens, for automated checks.
 */
export async function connectNewBank(
  options: { skipLink?: boolean } = {},
): Promise<ConnectOutcome> {
  let result: LinkResult;
  try {
    const token = await client.linkToken(PLAID_ENV, await getOrCreatePlaidUserId());
    reached();
    result =
      options.skipLink && PLAID_ENV === 'sandbox'
        ? {
            kind: 'success',
            publicToken: await client.sandboxConnect(),
            institution: 'First Platypus Bank',
          }
        : await link(token);
  } catch (e) {
    return { kind: 'problem', problem: noted(e), ...plaidCode(e) };
  }
  if (result.kind === 'exit') return { kind: 'didnt-connect' };

  // From here the bank login exists at Plaid and counts against the 10: save it first.
  const pending: BankConnection = {
    itemId: `pending-${Date.now().toString(36)}`,
    institution: result.institution,
    env: PLAID_ENV,
    status: 'exchanging',
    publicToken: result.publicToken,
    cursor: null,
    createdAt: localDateTime(new Date()),
  };
  await keep(pending);
  const outcome = await finishExchange(pending);
  // Offline right after Link: keep trying for a few minutes (setup doesn't sync by itself, and
  // Plaid's public token only lasts 30 minutes).
  if (outcome.kind === 'finish-later') void finishLater(pending.itemId);
  return outcome;
}

const FINISH_LATER_MS = [10_000, 30_000, 90_000, 240_000];

async function finishLater(itemId: string): Promise<void> {
  for (const delay of FINISH_LATER_MS) {
    await later(delay);
    const c = app().connections.find((x) => x.itemId === itemId && x.status === 'exchanging');
    if (!c) return;
    if ((await finishExchange(c)).kind !== 'finish-later') return;
  }
}

/** Pending connections being exchanged right now: one exchange at a time for each. */
const exchanging = new Set<string>();

async function finishExchange(pending: BankConnection): Promise<ConnectOutcome> {
  if (exchanging.has(pending.itemId)) {
    return { kind: 'finish-later', institution: pending.institution };
  }
  exchanging.add(pending.itemId);
  try {
    return await exchangeOnce(pending);
  } finally {
    exchanging.delete(pending.itemId);
  }
}

async function exchangeOnce(pending: BankConnection): Promise<ConnectOutcome> {
  let out: { access_token: string; item_id: string; used: number } | null = null;
  for (let attempt = 0; !out; attempt++) {
    try {
      out = await client.exchange(pending.publicToken ?? '');
      reached();
    } catch (e) {
      // The bank login already exists at Plaid and counts against the 10, so the public token
      // is let go only when Plaid says it's unusable (expired, unknown). Anything else (Plaid
      // busy, down for maintenance, offline) is tried again, then finished later.
      if (
        noted(e) === 'plaid' &&
        e instanceof WorkerError &&
        e.plaid?.error_code === 'INVALID_PUBLIC_TOKEN'
      ) {
        await forget(pending);
        return { kind: 'problem', problem: 'plaid', ...plaidCode(e) };
      }
      if (attempt >= 2) return { kind: 'finish-later', institution: pending.institution };
      await wait(1500 * (attempt + 1));
    }
  }
  const connection: BankConnection = {
    itemId: out.item_id,
    institution: pending.institution,
    env: pending.env,
    status: 'ok',
    accessToken: out.access_token,
    cursor: null,
    createdAt: pending.createdAt,
  };
  await keep(connection);
  await forget(pending);
  const used = out.used;
  useBank.setState((s) => ({
    count:
      s.count && pending.env === 'production'
        ? { ...s.count, used, left: Math.max(0, s.count.limit - used) }
        : s.count,
  }));
  const synced = await syncConnection(connection, { live: false });
  if (!synced || synced.notReady) void retryFirstSync(connection.itemId);
  return {
    kind: 'connected',
    institution: connection.institution,
    transactions: synced?.transactions ?? 0,
  };
}

/** The connection is still in the store as this sync found it (same token, same cursor). */
const unchanged = (c: BankConnection): boolean =>
  app().connections.some(
    (x) => x.itemId === c.itemId && x.accessToken === c.accessToken && x.cursor === c.cursor,
  );

/** Plaid is still sending this connection's history (see `historyDone`). */
const historyComing = (c: BankConnection): boolean =>
  c.historyDone === undefined ? !c.lastSynced : !c.historyDone;

/** Plaid usually has a new connection's transactions within a minute or two: ask again. */
const FIRST_SYNC_RETRIES_MS = [10_000, 30_000, 90_000];

async function retryFirstSync(itemId: string): Promise<void> {
  for (const delay of FIRST_SYNC_RETRIES_MS) {
    await wait(delay);
    const c = app().connections.find((x) => x.itemId === itemId);
    if (!c || c.lastSynced || c.status !== 'ok') return;
    if (app().phase === 'onboarding') await syncConnection(c, { live: false });
    else await syncAll();
  }
}

/** Connections whose exchange didn't finish (offline, app closed): finish or let go. */
export async function finishPendingExchanges(now = Date.now()): Promise<void> {
  for (const c of app().connections.filter((x) => x.status === 'exchanging')) {
    if (now - Date.parse(c.createdAt) > PUBLIC_TOKEN_MS) await forget(c);
    else await finishExchange(c);
  }
}

/** Reconnect: repair a connection in place (update mode). Never a new connection. */
export async function repairConnection(itemId: string): Promise<ConnectOutcome> {
  const connection = app().connections.find((c) => c.itemId === itemId);
  if (!connection?.accessToken) return { kind: 'problem', problem: 'unknown' };
  let result: LinkResult;
  try {
    const token = await client.repairToken(connection.accessToken, await getOrCreatePlaidUserId());
    reached();
    result = await link(token);
  } catch (e) {
    return { kind: 'problem', problem: noted(e), ...plaidCode(e) };
  }
  if (result.kind === 'exit') return { kind: 'didnt-connect' };
  const fixed: BankConnection = { ...connection, status: 'ok' };
  await keep(fixed);
  await syncConnection(fixed, { live: false });
  return { kind: 'repaired', institution: connection.institution };
}

/* ---------- syncing ---------- */

/**
 * One connection: accounts and balances (live ones on pull-to-refresh), card statements, and
 * transactions since its cursor. During setup the results go to the onboarding draft.
 */
async function syncConnection(
  connection: BankConnection,
  options: { live: boolean },
): Promise<{ transactions: number; notReady: boolean } | null> {
  if (!connection.accessToken) return null;
  const token = connection.accessToken;
  try {
    const syncedAt = localDateTime(new Date());
    const plaidAccounts = await client.accounts(token, options.live);
    const credit = plaidAccounts.some((a) => a.type === 'credit')
      ? await client.liabilities(token)
      : [];
    const statements = new Map(credit.map((l) => [l.account_id, l]));
    const accounts = plaidAccounts
      .map((a) => mapAccount(a, connection.itemId, syncedAt, statements.get(a.account_id)))
      .filter((a): a is Omit<Account, 'id'> => a !== null);
    const changes = await client.sync(token, connection.cursor);
    reached();
    // Delete everything, a restore or another sync may have changed this connection while the
    // bank answered: then these results belong to data that's gone, and aren't put back.
    if (!unchanged(connection)) return null;

    const s = app();
    if (s.phase === 'onboarding') {
      useOnboarding.getState().connectBank({ accounts, changes });
    } else {
      s.applyBankSync({
        accounts,
        changes,
        // A new connection's history (its first pull, then the rest) isn't news: only this
        // review week waits for the review.
        ...(historyComing(connection)
          ? { reviewedBefore: reviewWeekStart(s.data.today, s.data.weekStart) }
          : {}),
      });
    }
    // Right after linking, Plaid may have nothing yet: it says NOT_READY (an empty page with a
    // cursor), or sends no cursor at all. Leave the connection "Getting your transactions…" so
    // it's asked again soon instead of in 6 hours.
    const notReady =
      changes.notReady ||
      (!changes.cursor &&
        !changes.added.length &&
        !changes.modified.length &&
        !changes.removed.length);
    s.saveConnection({
      ...connection,
      status: 'ok',
      cursor: changes.cursor || null,
      historyDone: !notReady && !changes.historyPending,
      ...(notReady ? {} : { lastSynced: syncedAt }),
    });
    return { transactions: changes.added.length, notReady };
  } catch (e) {
    if (
      noted(e) === 'plaid' &&
      e instanceof WorkerError &&
      e.plaid &&
      problemOf(e.plaid) === 'needs-reauth' &&
      unchanged(connection)
    ) {
      app().saveConnection({ ...connection, status: 'needs-reauth' });
    }
    return null;
  }
}

let running: Promise<void> | null = null;

/**
 * Sync every connection that's due: on open when the last sync is over 6 hours old; `force`
 * for pull-to-refresh (with live balances) and after pairing. One sync at a time.
 */
export function syncAll(options: { live?: boolean; force?: boolean } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    const s = app();
    if (s.mode !== 'real' || !s.loaded) return;
    await finishPendingExchanges();
    const now = Date.now();
    const due = app().connections.filter(
      (c) =>
        c.status === 'ok' &&
        !!c.accessToken &&
        (options.force || !c.lastSynced || now - Date.parse(c.lastSynced) > SYNC_AFTER_MS),
    );
    if (!due.length) return;
    useBank.setState({ syncing: true });
    try {
      for (const c of due) await syncConnection(c, { live: !!options.live });
    } finally {
      useBank.setState({ syncing: false });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * A bank connected during an earlier, unfinished setup (the app was closed): bring it back
 * into the draft instead of connecting again.
 */
export async function resumeSetupConnections(): Promise<void> {
  if (app().connections.length) return;
  const saved = await loadConnections();
  for (const c of saved) {
    const fresh: BankConnection = { ...c, cursor: null };
    app().saveConnection(fresh);
    if (c.status === 'exchanging') await finishPendingExchanges();
    else await syncConnection(fresh, { live: false });
  }
}

/* ---------- ending connections ---------- */

/**
 * Delete everything → "Also end my bank connections at Plaid". Ended connections still count
 * against the 10, and a backup can't bring them back. Returns how many were ended.
 */
export async function endConnectionsAtPlaid(): Promise<{ ended: number; notEnded: number }> {
  let ended = 0;
  let notEnded = 0;
  for (const c of app().connections) {
    if (!c.accessToken) continue;
    try {
      await client.removeItem(c.accessToken);
      // Ended for good: forget it now, so trying again only asks about the rest.
      await forget(c);
      ended++;
    } catch (e) {
      noted(e);
      notEnded++;
    }
  }
  return { ended, notEnded };
}

/** Development builds: make a Sandbox connection ask to sign in again, to try Reconnect. */
export async function breakSandboxConnection(): Promise<boolean> {
  const c = app().connections.find((x) => x.env === 'sandbox' && x.accessToken);
  if (!c?.accessToken) return false;
  try {
    await client.sandboxResetLogin(c.accessToken);
    app().saveConnection({ ...c, lastSynced: undefined });
    await syncAll({ force: true });
    return true;
  } catch (e) {
    noted(e);
    return false;
  }
}

/* ---------- pairing ---------- */

export type PairResult = 'paired' | 'refused' | 'offline' | 'unavailable';

/** Pair this phone with the key from the QR code, and check it with the Worker. */
export async function pairWith(key: string): Promise<PairResult> {
  // Checked before it's saved: a link from anywhere (a web page, a message) could carry a
  // made-up key, and saving that would cut this phone off from its banks. Until the Worker
  // accepts the new key, the phone keeps the one it has.
  try {
    const status = await client.statusWith(key);
    await saveWorkerKey(key);
    reached();
    useBank.setState({ count: status });
    void syncAll({ force: true });
    return 'paired';
  } catch (e) {
    if (!(e instanceof WorkerError)) return 'unavailable';
    if (e.problem === 'key-refused') return 'refused';
    if (e.problem === 'offline') return 'offline';
    return 'unavailable';
  }
}

/** The access key from a QR code link: 32+ URL-safe characters, nothing else. */
export const isPairingKey = (key: string): boolean => /^[A-Za-z0-9_-]{32,128}$/.test(key);

/* ---------- when to sync ---------- */

/**
 * Background refresh: only with data already in memory (see services/background.ts); the
 * autosave writes the result before iOS suspends the app again.
 */
async function backgroundSync(): Promise<void> {
  const s = app();
  if (s.mode !== 'real' || !s.loaded || !s.connections.length) return;
  await syncAll();
  const { flushSaves } = await import('./session');
  await flushSaves();
}

/** Sync when data is loaded or the app comes back, and learn whether this phone is paired. */
export function startBankSync(): () => void {
  setBackgroundRefresh(backgroundSync);
  void readWorkerKey()
    .then((key) => {
      if (!key) useBank.setState({ access: 'not-paired' });
    })
    .catch(() => undefined);
  const unsubscribe = useAppStore.subscribe((s, prev) => {
    if (s.loaded && s.phase === 'ready' && !(prev.loaded && prev.phase === 'ready')) {
      void syncAll();
      if (s.connections.length) void registerBackgroundRefresh();
    }
  });
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void syncAll();
  });
  return () => {
    unsubscribe();
    sub.remove();
  };
}

/** After Delete everything: this phone is no longer paired. */
export const resetBankUi = (): void =>
  useBank.setState({ access: 'not-paired', syncing: false, offline: false, count: null });
