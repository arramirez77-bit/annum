/**
 * The repository: everything Annum keeps, read and written as one `Stored` value. Saving
 * compares each row with what was last read or written and only touches rows that changed,
 * inside one transaction, so a save is all-or-nothing.
 */
import type {
  Account,
  Bill,
  Buckets,
  CsvMapping,
  Cents,
  CategoryRule,
  DeferredPurchase,
  Deposit,
  ExpectedIncome,
  ISODate,
  Settings,
  Transaction,
  WeekStart,
} from '@/domain';

import type { Bind, Db } from './schema';

export interface PendingTransfer {
  amount: Cents;
  markedOn: ISODate;
}

/** A confirmed split, kept as history (the deposit row keeps the latest one too). */
export interface SplitRecord {
  id: string;
  depositId?: string;
  date: ISODate;
  split: Buckets;
}

/** One finished weekly review. */
export interface ReviewRecord {
  id: string;
  date: ISODate;
  /** What was moved from savings to checking, if anything. */
  transfer?: Cents;
}

/** S11: what the last import did, for the result row. */
export interface LastImport {
  account: string;
  on: ISODate;
  from?: ISODate;
  to?: ISODate;
  added: number;
  duplicates: number;
}

/**
 * A bank connection (a Plaid Item). The access token lives only here, in the encrypted
 * database, so an encrypted backup brings the connection back without using one of the 10.
 * Never log it, show it, or put it in a URL.
 */
export interface BankConnection {
  /** Plaid's item_id; for a connection still being finished, a temporary id. */
  itemId: string;
  /** The bank's name from Plaid Link, for Settings ("Bank A"). */
  institution: string;
  env: 'sandbox' | 'production';
  /**
   * ok · needs-reauth: the bank asks to sign in again (Reconnect, update mode) ·
   * exchanging: Link finished but the token exchange hasn't yet (kept so a restart can finish
   * it within the public token's 30 minutes: the connection is already used at Plaid).
   */
  status: 'ok' | 'needs-reauth' | 'exchanging';
  accessToken?: string;
  /** Only while exchanging. */
  publicToken?: string;
  /** transactions/sync position; null until the first full sync is saved. */
  cursor: string | null;
  /** ISO datetime (local) the connection was made, and of its last good sync. */
  createdAt: string;
  lastSynced?: string;
  /**
   * Plaid has sent all the history it will (its first pull brings ~30 days, the rest follows).
   * Until then, transactions from before this review week arrive already reviewed. Missing on
   * connections saved before this existed: those count as done once they've synced.
   */
  historyDone?: boolean;
}

/** Preferences that aren't money settings (S3 Notifications and Privacy, S11 imports). */
export interface Prefs {
  showAmountsOnLockScreen: boolean;
  /** CSV column mappings the user confirmed, by the file's header row. */
  importMappings: Record<string, CsvMapping>;
  lastImport: LastImport | null;
  reminders: {
    /** Weekly review: 0 = Sunday … 6 = Saturday, at hour:minute. Null = off. */
    weekly: { weekday: number; hour: number; minute: number } | null;
    cardStatements: boolean;
    quarterlyTaxes: boolean;
    deposits: boolean;
  };
}

export const DEFAULT_PREFS: Prefs = {
  showAmountsOnLockScreen: true,
  importMappings: {},
  lastImport: null,
  reminders: { weekly: null, cardStatements: false, quarterlyTaxes: false, deposits: false },
};

/** Reminders as O4c turns them on: Sunday 10 AM plus the three event reminders. */
export const REMINDERS_ON: Prefs['reminders'] = {
  weekly: { weekday: 0, hour: 10, minute: 0 },
  cardStatements: true,
  quarterlyTaxes: true,
  deposits: true,
};

export interface Stored {
  settings: Settings;
  prefs: Prefs;
  accounts: Account[];
  buckets: Buckets;
  bills: Bill[];
  expectedIncome: ExpectedIncome[];
  transactions: Transaction[];
  deposits: Deposit[];
  splits: SplitRecord[];
  reviews: ReviewRecord[];
  rules: CategoryRule[];
  deferred: DeferredPurchase[];
  connections: BankConnection[];
  weekStart?: WeekStart;
  savingsUnsplit: boolean;
  lateAssumeDays: number;
  /** Weekly review: the step to resume at. */
  reviewStep: number;
  pendingTransfer: PendingTransfer | null;
  /** The day onboarding finished. */
  startedOn: ISODate;
}

interface Table<T> {
  name: string;
  list: (s: Stored) => readonly T[];
  id: (row: T) => string;
  /** Indexed columns besides id and body, in order. */
  columns: string[];
  values: (row: T) => Bind[];
}

const table = <T>(t: Table<T>) => t;

const TABLES = [
  table<Account>({
    name: 'accounts',
    list: (s) => s.accounts,
    id: (a) => a.id,
    columns: ['type', 'source'],
    values: (a) => [a.type, a.source],
  }),
  table<Transaction>({
    name: 'transactions',
    list: (s) => s.transactions,
    id: (t) => t.id,
    columns: ['account_id', 'date', 'amount', 'external_id'],
    values: (t) => [t.accountId, t.date, t.amount, t.externalId ?? null],
  }),
  table<Bill>({
    name: 'bills',
    list: (s) => s.bills,
    id: (b) => b.id,
    columns: ['due'],
    values: (b) => [b.due],
  }),
  table<ExpectedIncome>({
    name: 'expected_income',
    list: (s) => s.expectedIncome,
    id: (i) => i.id,
    columns: ['date'],
    values: (i) => [i.date],
  }),
  table<Deposit>({
    name: 'deposits',
    list: (s) => s.deposits,
    id: (d) => d.id,
    columns: ['date', 'confirmed'],
    values: (d) => [d.date, d.confirmed ? 1 : 0],
  }),
  table<SplitRecord>({
    name: 'splits',
    list: (s) => s.splits,
    id: (r) => r.id,
    columns: ['deposit_id', 'date'],
    values: (r) => [r.depositId ?? null, r.date],
  }),
  table<ReviewRecord>({
    name: 'reviews',
    list: (s) => s.reviews,
    id: (r) => r.id,
    columns: ['date'],
    values: (r) => [r.date],
  }),
  table<CategoryRule>({
    name: 'rules',
    list: (s) => s.rules,
    id: (r) => r.merchant,
    columns: [],
    values: () => [],
  }),
  table<DeferredPurchase>({
    name: 'deferred',
    list: (s) => s.deferred,
    id: (d) => d.id,
    columns: ['wait_until', 'status'],
    values: (d) => [d.waitUntil, d.status],
  }),
  table<BankConnection>({
    name: 'connections',
    list: (s) => s.connections,
    id: (c) => c.itemId,
    columns: ['status'],
    values: (c) => [c.status],
  }),
] as Table<unknown>[];

/** Key/value rows: Settings fields and prefs go in `settings`, the rest in `meta`. */
function keyValues(s: Stored): { settings: Map<string, string>; meta: Map<string, string> } {
  const settings = new Map<string, string>();
  // Keys set to undefined (e.g. no pay schedule) aren't saved; loading leaves them out too.
  for (const [k, v] of Object.entries(s.settings)) {
    if (v !== undefined) settings.set(k, JSON.stringify(v));
  }
  for (const [k, v] of Object.entries(s.prefs)) {
    if (v !== undefined) settings.set(`prefs.${k}`, JSON.stringify(v));
  }
  const meta = new Map<string, string>(
    Object.entries({
      buckets: s.buckets,
      weekStart: s.weekStart ?? null,
      savingsUnsplit: s.savingsUnsplit,
      lateAssumeDays: s.lateAssumeDays,
      reviewStep: s.reviewStep,
      pendingTransfer: s.pendingTransfer,
      startedOn: s.startedOn,
    }).map(([k, v]) => [k, JSON.stringify(v)]),
  );
  return { settings, meta };
}

type Rows = Map<string, string>;

export class Repo {
  /** What the file holds now, per table: id → JSON body. */
  private saved = new Map<string, Rows>();

  constructor(private readonly db: Db) {}

  /** Null when onboarding hasn't finished (no `startedOn`). */
  async load(): Promise<Stored | null> {
    const kv = async (name: 'settings' | 'meta') => {
      const rows = await this.db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM ${name}`,
        [],
      );
      this.saved.set(name, new Map(rows.map((r) => [r.key, r.value])));
      return new Map(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
    };
    const meta = await kv('meta');
    const settingsRows = await kv('settings');
    if (!meta.has('startedOn')) return null;

    const lists: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      const rows = await this.db.getAllAsync<{ id: string; body: string }>(
        `SELECT id, body FROM ${t.name} ORDER BY rowid`,
        [],
      );
      this.saved.set(t.name, new Map(rows.map((r) => [r.id, r.body])));
      lists[t.name] = rows.map((r) => JSON.parse(r.body) as unknown);
    }

    const settings: Record<string, unknown> = {};
    const prefs: Record<string, unknown> = { ...DEFAULT_PREFS };
    for (const [k, v] of settingsRows) {
      if (k.startsWith('prefs.')) prefs[k.slice(6)] = v;
      else settings[k] = v;
    }
    const m = <T>(key: string, fallback: T): T => (meta.has(key) ? (meta.get(key) as T) : fallback);
    const weekStart = m<WeekStart | null>('weekStart', null);
    return {
      settings: settings as unknown as Settings,
      prefs: prefs as unknown as Prefs,
      accounts: lists.accounts as Account[],
      transactions: lists.transactions as Transaction[],
      bills: lists.bills as Bill[],
      expectedIncome: lists.expected_income as ExpectedIncome[],
      deposits: lists.deposits as Deposit[],
      splits: lists.splits as SplitRecord[],
      reviews: lists.reviews as ReviewRecord[],
      rules: lists.rules as CategoryRule[],
      deferred: lists.deferred as DeferredPurchase[],
      connections: lists.connections as BankConnection[],
      buckets: m<Buckets>('buckets', { tax: 0, bills: 0, runway: 0, invest: 0, free: 0 }),
      ...(weekStart ? { weekStart } : {}),
      savingsUnsplit: m('savingsUnsplit', false),
      lateAssumeDays: m('lateAssumeDays', 5),
      reviewStep: m('reviewStep', 1),
      pendingTransfer: m<PendingTransfer | null>('pendingTransfer', null),
      startedOn: m('startedOn', ''),
    };
  }

  /** Write what changed since the last load or save. Returns how many rows it touched. */
  async save(next: Stored): Promise<number> {
    const plan: { sql: string; params: Bind[] }[] = [];
    const nextSaved = new Map<string, Rows>();

    for (const t of TABLES) {
      const before = this.saved.get(t.name) ?? new Map<string, string>();
      const after: Rows = new Map();
      const cols = ['id', ...t.columns, 'body'];
      // An upsert keeps the row's place (REPLACE would move it to the end).
      const upsert =
        `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ` +
        `ON CONFLICT (id) DO UPDATE SET ${cols
          .slice(1)
          .map((c) => `${c} = excluded.${c}`)
          .join(', ')}`;
      for (const row of t.list(next)) {
        const id = t.id(row);
        const body = JSON.stringify(row);
        after.set(id, body);
        if (before.get(id) !== body)
          plan.push({ sql: upsert, params: [id, ...t.values(row), body] });
      }
      for (const id of before.keys()) {
        if (!after.has(id)) plan.push({ sql: `DELETE FROM ${t.name} WHERE id = ?`, params: [id] });
      }
      nextSaved.set(t.name, after);
    }

    const { settings, meta } = keyValues(next);
    for (const [name, after] of [
      ['settings', settings],
      ['meta', meta],
    ] as const) {
      const before = this.saved.get(name) ?? new Map<string, string>();
      for (const [key, value] of after) {
        if (before.get(key) !== value) {
          plan.push({
            sql: `INSERT INTO ${name} (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            params: [key, value],
          });
        }
      }
      for (const key of before.keys()) {
        if (!after.has(key)) plan.push({ sql: `DELETE FROM ${name} WHERE key = ?`, params: [key] });
      }
      nextSaved.set(name, after);
    }

    if (plan.length) {
      await this.db.withTransactionAsync(async () => {
        for (const step of plan) await this.db.runAsync(step.sql, step.params);
      });
    }
    this.saved = nextSaved;
    return plan.length;
  }

  /**
   * Bank connections on their own: read before onboarding has finished (a connection made
   * during setup is saved at once, since it can't be made again).
   */
  async loadConnections(): Promise<BankConnection[]> {
    const rows = await this.db.getAllAsync<{ id: string; body: string }>(
      'SELECT id, body FROM connections ORDER BY rowid',
      [],
    );
    return rows.map((r) => JSON.parse(r.body) as BankConnection);
  }

  /** Save one connection now, outside the usual save (see BankConnection). */
  async putConnection(c: BankConnection): Promise<void> {
    const body = JSON.stringify(c);
    await this.db.runAsync(
      'INSERT INTO connections (id, status, body) VALUES (?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET status = excluded.status, body = excluded.body',
      [c.itemId, c.status, body],
    );
    const saved = this.saved.get('connections') ?? new Map<string, string>();
    saved.set(c.itemId, body);
    this.saved.set('connections', saved);
  }

  async deleteConnection(itemId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM connections WHERE id = ?', [itemId]);
    this.saved.get('connections')?.delete(itemId);
  }

  /** Empty every table (Import backup replaces everything; Delete everything removes the file). */
  async clear(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const name of [...TABLES.map((t) => t.name), 'settings', 'meta']) {
        await this.db.execAsync(`DELETE FROM ${name}`);
      }
    });
    this.saved = new Map();
  }
}

/** Every table a backup copies, in order. */
export const TABLE_NAMES = [...TABLES.map((t) => t.name), 'settings', 'meta'];
