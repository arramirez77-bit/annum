/**
 * Bank connections end to end in Jest: the app's Worker client → the real Worker code
 * (worker/src/handler.ts) → a fake Plaid. Native pieces (Keychain, database, Link) are fakes.
 */
import { workerClient } from '@/data/plaid/client';
import { DEFAULT_PREFS, type BankConnection } from '@/data/repo';
import { newAppData } from '@/domain';

import { COUNT_KEY, handle, type Env } from '../../../worker/src/handler';
import {
  checkCount,
  connectNewBank,
  endConnectionsAtPlaid,
  finishPendingExchanges,
  pairWith,
  repairConnection,
  resumeSetupConnections,
  setBankTestDoubles,
  syncAll,
  useBank,
} from '../bank';
import { useOnboarding } from '../onboarding';
import { useAppStore } from '../store';

/* ---------- fakes for the native pieces ---------- */

const mockDisk = new Map<string, BankConnection>();
const mockSaves: string[] = [];
jest.mock('@/data/storage', () => ({
  putConnection: jest.fn(async (c: BankConnection) => {
    mockSaves.push(`${c.itemId}:${c.status}`);
    mockDisk.set(c.itemId, c);
  }),
  deleteConnection: jest.fn(async (id: string) => void mockDisk.delete(id)),
  loadConnections: jest.fn(async () => [...mockDisk.values()]),
}));

let mockPhoneKey: string | null = 'k'.repeat(43);
jest.mock('@/data/secure', () => ({
  readWorkerKey: jest.fn(async () => mockPhoneKey),
  saveWorkerKey: jest.fn(async (k: string) => {
    mockPhoneKey = k;
  }),
  getOrCreatePlaidUserId: jest.fn(async () => 'phone-0123456789abcdef'),
}));

jest.mock('@/services/plaid-link', () => ({ openPlaidLink: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

/* ---------- a fake Plaid behind the real Worker ---------- */

interface FakePlaid {
  calls: string[];
  loginRequired: boolean;
  down: boolean;
  /** How many more first syncs come back empty with no cursor. */
  notReady: number;
  /** How many more first syncs say NOT_READY: an empty page, but with a cursor (Plaid's docs). */
  pending: number;
  /** Older transactions (before this review week) Plaid sends for a new connection. */
  history: ReturnType<typeof txn>[];
  /** The first batch is recent only (INITIAL_UPDATE_COMPLETE); history follows next sync. */
  twoStage: boolean;
}
const plaid: FakePlaid = {
  calls: [],
  loginRequired: false,
  down: false,
  notReady: 0,
  pending: 0,
  history: [],
  twoStage: false,
};
const kv = new Map<string, string>();
const workerEnv: Env = {
  PLAID_CLIENT_ID: 'client',
  PLAID_SECRET_SANDBOX: 'sandbox-secret',
  ANNUM_WORKER_KEY: 'k'.repeat(43),
  COUNT: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) },
};

const txn = (id: string, amount: number, date: string, name: string, account = 'pa-chk') => ({
  transaction_id: id,
  account_id: account,
  amount,
  date,
  name,
  pending: false,
});

function fakePlaid(url: string, init: RequestInit): Promise<Response> {
  const path = new URL(url).pathname.slice(1);
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  plaid.calls.push(path);
  const ok = (b: unknown) => Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
  if (plaid.loginRequired && body.access_token && path !== 'link/token/create') {
    return Promise.resolve(
      new Response(
        JSON.stringify({ error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED' }),
        { status: 400 },
      ),
    );
  }
  switch (path) {
    case 'link/token/create':
      return ok({ link_token: 'link-sandbox-1' });
    case 'sandbox/public_token/create':
      return ok({ public_token: 'public-sandbox-1' });
    case 'item/public_token/exchange':
      return ok({ access_token: 'access-sandbox-1', item_id: 'item-1' });
    case 'accounts/get':
    case 'accounts/balance/get':
      return ok({
        accounts: [
          {
            account_id: 'pa-chk',
            name: 'Plaid Checking',
            mask: '0000',
            type: 'depository',
            subtype: 'checking',
            balances: { current: 110, available: 100 },
          },
          {
            account_id: 'pa-sav',
            name: 'Plaid Saving',
            mask: '1111',
            type: 'depository',
            subtype: 'savings',
            balances: { current: 210, available: 200 },
          },
          {
            account_id: 'pa-card',
            name: 'Plaid Credit Card',
            mask: '3333',
            type: 'credit',
            subtype: 'credit card',
            balances: { current: 410, available: 2000 },
          },
        ],
      });
    case 'liabilities/get':
      return ok({
        liabilities: {
          credit: [
            {
              account_id: 'pa-card',
              last_statement_balance: 410,
              last_statement_issue_date: '2026-09-01',
              last_payment_amount: 0,
              last_payment_date: null,
              next_payment_due_date: '2026-10-05',
            },
          ],
        },
      });
    case 'transactions/sync':
      if (!body.cursor && plaid.notReady > 0) {
        plaid.notReady--;
        return ok({ added: [], modified: [], removed: [], next_cursor: '', has_more: false });
      }
      if ((!body.cursor || body.cursor === 'c0') && plaid.pending > 0) {
        plaid.pending--;
        return ok({
          added: [],
          modified: [],
          removed: [],
          next_cursor: 'c0',
          has_more: false,
          transactions_update_status: 'NOT_READY',
        });
      }
      // Older history comes with the first batch, or (twoStage) with the next one.
      return ok(
        body.cursor && body.cursor !== 'c0'
          ? {
              added: [
                txn('t3', 6.33, '2026-09-26', 'Starbucks'),
                ...(plaid.twoStage ? plaid.history : []),
              ],
              modified: [],
              removed: [],
              next_cursor: 'c2',
              has_more: false,
              transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
            }
          : {
              added: [
                txn('t1', 89.4, '2026-09-24', 'SparkFun'),
                txn('t2', -500, '2026-09-25', 'INTRST PYMNT', 'pa-sav'),
                ...(plaid.twoStage ? [] : plaid.history),
              ],
              modified: [],
              removed: [],
              next_cursor: 'c1',
              has_more: false,
              transactions_update_status: plaid.twoStage
                ? 'INITIAL_UPDATE_COMPLETE'
                : 'HISTORICAL_UPDATE_COMPLETE',
            },
      );
    case 'item/remove':
      return ok({ request_id: 'r' });
    default:
      return Promise.resolve(new Response('{}', { status: 404 }));
  }
}

const worker = workerClient({
  baseUrl: 'https://annum.example',
  getKey: async () => mockPhoneKey,
  fetch: (url, init) =>
    plaid.down
      ? Promise.reject(new TypeError('Network request failed'))
      : handle(new Request(url, init), workerEnv, fakePlaid),
});

const link = jest.fn();
setBankTestDoubles({ client: worker, link, wait: async () => undefined });

const s = () => useAppStore.getState();
const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
  jest.spyOn(console, m),
);

beforeEach(() => {
  mockDisk.clear();
  mockSaves.length = 0;
  kv.clear();
  kv.set(COUNT_KEY, '3');
  plaid.calls = [];
  plaid.loginRequired = false;
  plaid.down = false;
  plaid.notReady = 0;
  plaid.pending = 0;
  plaid.history = [];
  plaid.twoStage = false;
  mockPhoneKey = 'k'.repeat(43);
  link.mockReset();
  link.mockResolvedValue({
    kind: 'success',
    publicToken: 'public-sandbox-1',
    institution: 'Bank A',
  });
  useBank.setState({ access: 'unknown', syncing: false, offline: false, count: null });
  useOnboarding.getState().clear();
  s().reset();
});

afterEach(() => {
  // Tokens, balances, transactions: nothing is ever logged.
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
});

/** Real mode, onboarding finished, with one connection. */
function realWith(connections: BankConnection[]) {
  s().hydrate(
    {
      data: newAppData({ today: '2026-09-27', incomeType: 'freelance', accounts: [] }),
      prefs: DEFAULT_PREFS,
      deposits: [],
      splits: [],
      reviews: [],
      rules: [],
      deferred: [],
      connections,
      reviewStep: 1,
      pendingTransfer: null,
      startedOn: '2026-09-20',
    },
    false,
  );
}

const connected: BankConnection = {
  itemId: 'item-1',
  institution: 'Bank A',
  env: 'sandbox',
  status: 'ok',
  accessToken: 'access-sandbox-1',
  cursor: 'c1',
  createdAt: '2026-09-20T09:00:00',
  lastSynced: '2026-09-20T09:00:00',
};

describe('the shared count', () => {
  it('comes from the Worker', async () => {
    const r = await checkCount();
    expect(r).toEqual({
      kind: 'ok',
      status: { used: 3, limit: 10, left: 7, sandbox: true, production: false },
    });
    expect(useBank.getState().access).toBe('paired');
  });

  it("knows when the phone isn't paired, or its key was replaced", async () => {
    mockPhoneKey = null;
    expect(await checkCount()).toEqual({ kind: 'problem', problem: 'not-paired' });
    expect(useBank.getState().access).toBe('not-paired');
    mockPhoneKey = 'old-key-that-was-replaced-long-enough';
    expect(await checkCount()).toEqual({ kind: 'problem', problem: 'key-refused' });
    expect(useBank.getState().access).toBe('key-refused');
  });
});

describe('connecting during setup', () => {
  beforeEach(() => s().setPhase('onboarding'));

  it('saves the connection before exchanging, then fills the draft', async () => {
    const r = await connectNewBank();
    expect(r).toEqual({ kind: 'connected', institution: 'Bank A', transactions: 2 });
    // Saved as soon as Link finished, then replaced by the real item.
    expect(mockSaves[0]).toMatch(/^pending-.*:exchanging$/);
    expect(mockSaves[1]).toBe('item-1:ok');
    expect([...mockDisk.keys()]).toEqual(['item-1']);
    expect(s().connections).toMatchObject([{ itemId: 'item-1', status: 'ok', cursor: 'c1' }]);

    const draft = useOnboarding.getState();
    expect(draft.path).toBe('bank');
    expect(draft.accounts.map((a) => [a.type, a.balance, a.source])).toEqual([
      ['checking', 10000, 'plaid'],
      ['savings', 21000, 'plaid'],
      ['card', 41000, 'plaid'],
    ]);
    expect(draft.accounts[2]).toMatchObject({
      statementBalance: 41000,
      statementDue: '2026-10-05',
    });
    expect(draft.transactions.map((t) => [t.merchant, t.amount])).toEqual([
      ['SparkFun', -8940],
      ['Intrst Pymnt', 50000],
    ]);
    // Sandbox connections are free: the count doesn't move.
    expect(kv.get(COUNT_KEY)).toBe('3');
  });

  it('E4: closing Link saves nothing and uses no connection', async () => {
    link.mockResolvedValue({ kind: 'exit' });
    expect(await connectNewBank()).toEqual({ kind: 'didnt-connect' });
    expect(mockSaves).toEqual([]);
    expect(plaid.calls).toEqual(['link/token/create']);
  });

  it("doesn't open Link on a phone that isn't paired", async () => {
    mockPhoneKey = null;
    expect(await connectNewBank()).toEqual({ kind: 'problem', problem: 'not-paired' });
    expect(link).not.toHaveBeenCalled();
  });

  it('finishes a connection later if the network drops right after Link', async () => {
    link.mockImplementation(async () => {
      plaid.down = true; // the phone loses signal as Link closes
      return { kind: 'success', publicToken: 'public-sandbox-1', institution: 'Bank A' };
    });
    expect(await connectNewBank()).toEqual({ kind: 'finish-later', institution: 'Bank A' });
    expect(s().connections).toMatchObject([{ status: 'exchanging', institution: 'Bank A' }]);
    expect([...mockDisk.values()]).toMatchObject([{ status: 'exchanging' }]);

    plaid.down = false;
    await finishPendingExchanges();
    expect(s().connections).toMatchObject([{ itemId: 'item-1', status: 'ok' }]);
    expect([...mockDisk.keys()]).toEqual(['item-1']);
  });

  it('lets go of an unfinished connection after the 30 minutes Plaid allows', async () => {
    const stale: BankConnection = {
      itemId: 'pending-x',
      institution: 'Bank A',
      env: 'sandbox',
      status: 'exchanging',
      publicToken: 'public-sandbox-old',
      cursor: null,
      createdAt: '2026-09-27T08:00:00',
    };
    s().saveConnection(stale);
    await finishPendingExchanges(Date.parse('2026-09-27T09:00:00'));
    expect(s().connections).toEqual([]);
    expect(plaid.calls).toEqual([]);
  });

  it('brings back a bank connected before the app was closed, without connecting again', async () => {
    mockDisk.set('item-1', { ...connected, cursor: 'c1' });
    await resumeSetupConnections();
    expect(useOnboarding.getState().accounts).toHaveLength(3);
    expect(plaid.calls).not.toContain('link/token/create');
    expect(plaid.calls).not.toContain('item/public_token/exchange');
  });

  it('a test connection can skip Link (Sandbox only)', async () => {
    expect(await connectNewBank({ skipLink: true })).toMatchObject({ kind: 'connected' });
    expect(link).not.toHaveBeenCalled();
    expect(plaid.calls).toContain('sandbox/public_token/create');
  });
});

describe('a brand-new connection', () => {
  it('asks again when Plaid has nothing yet, instead of waiting 6 hours', async () => {
    realWith([]);
    plaid.notReady = 2; // the first two syncs come back empty
    const r = await connectNewBank();
    expect(r).toMatchObject({ kind: 'connected', transactions: 0 });
    // The retries run (with no waiting in tests) until transactions arrive.
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    await syncAll();
    expect(s().connections[0]).toMatchObject({ cursor: 'c1' });
    expect(s().connections[0].lastSynced).toBeDefined();
    expect(s().data.transactions.length).toBeGreaterThan(0);
  });

  it('keeps asking while Plaid says NOT_READY, even though it sent a cursor', async () => {
    realWith([]);
    plaid.pending = 2; // the first sync and the first retry: an empty page with cursor c0
    plaid.history = [txn('t0', 42, '2025-06-02', 'Old Shop')];
    const r = await connectNewBank();
    expect(r).toMatchObject({ kind: 'connected', transactions: 0 });
    // The retries run in the background (no waiting in tests), continuing from c0.
    for (let i = 0; i < 50 && !s().connections[0]?.lastSynced; i++) {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    }
    expect(s().connections[0]).toMatchObject({ cursor: 'c1' });
    expect(s().connections[0].lastSynced).toBeDefined();
    // Last year's history isn't news; this review week (from Sep 21) still waits for review.
    expect(reviewedByMerchant()).toEqual({
      'Intrst Pymnt': false,
      'Old Shop': true,
      SparkFun: false,
    });
    expect(s().connections[0].historyDone).toBe(true);
  });

  it('history that follows the first batch arrives reviewed too', async () => {
    realWith([]);
    plaid.twoStage = true; // first: recent only (INITIAL_UPDATE_COMPLETE); then the rest
    plaid.history = [txn('t0', 42, '2025-06-02', 'Old Shop')];
    await connectNewBank();
    expect(s().connections[0]).toMatchObject({ cursor: 'c1', historyDone: false });
    await syncAll({ force: true });
    expect(s().connections[0]).toMatchObject({ cursor: 'c2', historyDone: true });
    expect(reviewedByMerchant()).toMatchObject({ 'Old Shop': true, Starbucks: false });
  });

  it('a connection that has finished syncing leaves review state alone', async () => {
    realWith([connected]); // synced before `historyDone` existed
    plaid.twoStage = true; // its next batch carries an older posting
    plaid.history = [txn('t9', 7, '2026-09-01', 'Late Posting')];
    await syncAll({ force: true });
    expect(reviewedByMerchant()).toEqual({ Starbucks: false, 'Late Posting': false });
    expect(s().connections[0].historyDone).toBe(true);
  });
});

const reviewedByMerchant = () =>
  Object.fromEntries(s().data.transactions.map((t) => [t.merchant, t.reviewed]));

describe('syncing', () => {
  it('syncs from the cursor, and not again within 6 hours', async () => {
    realWith([connected]);
    // hydrate starts nothing by itself in tests; sync by hand.
    await syncAll();
    expect(s().data.transactions.map((t) => t.merchant)).toEqual(['Starbucks']);
    expect(s().data.accounts).toHaveLength(3);
    expect(s().connections[0]).toMatchObject({ cursor: 'c2' });
    plaid.calls = [];
    await syncAll();
    expect(plaid.calls).toEqual([]);
    await syncAll({ force: true, live: true });
    expect(plaid.calls).toContain('accounts/balance/get');
  });

  it('marks a connection that needs signing in again, and skips it until repaired', async () => {
    realWith([connected]);
    plaid.loginRequired = true;
    await syncAll();
    expect(s().connections[0].status).toBe('needs-reauth');
    plaid.calls = [];
    await syncAll({ force: true });
    expect(plaid.calls).toEqual([]);
  });

  it('Reconnect repairs in place (update mode), never a new connection', async () => {
    realWith([{ ...connected, status: 'needs-reauth' }]);
    plaid.loginRequired = false;
    expect(await repairConnection('item-1')).toEqual({ kind: 'repaired', institution: 'Bank A' });
    expect(s().connections).toMatchObject([{ itemId: 'item-1', status: 'ok' }]);
    expect(plaid.calls).not.toContain('item/public_token/exchange');
    expect(plaid.calls).not.toContain('sandbox/public_token/create');
    expect(kv.get(COUNT_KEY)).toBe('3');
  });

  it('says offline instead of failing', async () => {
    realWith([connected]);
    plaid.down = true;
    await syncAll({ force: true });
    expect(useBank.getState()).toMatchObject({ offline: true, syncing: false });
    expect(s().connections[0].status).toBe('ok');
  });

  it('never syncs demo data', async () => {
    s().setScenario('on-track');
    await syncAll({ force: true });
    expect(plaid.calls).toEqual([]);
  });
});

describe('pairing and ending', () => {
  it('pairs with a scanned key', async () => {
    mockPhoneKey = null;
    expect(await pairWith('k'.repeat(43))).toBe('paired');
    expect(useBank.getState().access).toBe('paired');
    expect(await pairWith('x'.repeat(43))).toBe('refused');
  });

  it('ends every connection at Plaid only when asked', async () => {
    realWith([connected, { ...connected, itemId: 'item-2' }]);
    expect(await endConnectionsAtPlaid()).toBe(2);
    expect(plaid.calls.filter((c) => c === 'item/remove')).toHaveLength(2);
  });
});
