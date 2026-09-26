/**
 * The repository against real SQLite (Node's built-in node:sqlite; SQLCipher itself only runs
 * on iOS and is covered by the SQLCipher spike and the Simulator flows).
 */
import { DatabaseSync } from 'node:sqlite';

import { demoSeed } from '@/data/demo';
import { DEFAULT_PREFS, Repo, type Stored } from '@/data/repo';
import {
  migrate,
  MIGRATIONS,
  NewerSchemaError,
  schemaVersion,
  type Bind,
  type Db,
} from '@/data/schema';

/** node:sqlite behind the same small async API as expo-sqlite. */
function nodeDb(): Db & { raw: DatabaseSync; statements: string[] } {
  const raw = new DatabaseSync(':memory:');
  const statements: string[] = [];
  const db = {
    raw,
    statements,
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, params: Bind[]) => {
      statements.push(/^(INSERT INTO|DELETE FROM) \w+/.exec(sql)?.[0] ?? sql);
      return raw.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, params: Bind[]) => raw.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, params: Bind[]) =>
      (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}

const seed = demoSeed();
const stored = (): Stored => ({
  settings: seed.settings,
  prefs: DEFAULT_PREFS,
  accounts: seed.accounts,
  buckets: seed.buckets,
  bills: seed.bills,
  expectedIncome: seed.expectedIncome,
  transactions: seed.transactions,
  deposits: seed.pendingDeposit ? [seed.pendingDeposit] : [],
  splits: [],
  reviews: [],
  rules: [{ merchant: 'litware', category: 'Software', tax: true }],
  deferred: [],
  weekStart: seed.weekStart,
  savingsUnsplit: false,
  lateAssumeDays: 5,
  reviewStep: 1,
  pendingTransfer: null,
  startedOn: '2026-09-20',
});

describe('migrations', () => {
  test('a new file migrates to the latest version and a second run does nothing', async () => {
    const db = nodeDb();
    expect(await migrate(db)).toBe(0);
    expect(await schemaVersion(db)).toBe(MIGRATIONS.length);
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    // docs/02: accounts, transactions, bills, expected_income, deposits, splits, reviews, rules, deferred, settings, meta
    expect(tables).toEqual([
      'accounts',
      'bills',
      'deferred',
      'deposits',
      'expected_income',
      'meta',
      'reviews',
      'rules',
      'settings',
      'splits',
      'transactions',
    ]);
  });

  test('a file from a newer Annum is refused, not overwritten', async () => {
    const db = nodeDb();
    db.raw.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    await expect(migrate(db)).rejects.toBeInstanceOf(NewerSchemaError);
  });
});

describe('repository', () => {
  test('before onboarding finishes there is nothing to load', async () => {
    const db = nodeDb();
    await migrate(db);
    expect(await new Repo(db).load()).toBeNull();
  });

  test('what is saved comes back the same (a restart keeps everything)', async () => {
    const db = nodeDb();
    await migrate(db);
    await new Repo(db).save(stored());
    const loaded = await new Repo(db).load();
    expect(loaded).toEqual(stored());
  });

  test('a setting that is undefined (no pay schedule) is left out, not a failed save', async () => {
    const db = nodeDb();
    await migrate(db);
    const next = stored();
    next.settings = { ...next.settings, paySchedule: undefined };
    await new Repo(db).save(next);
    expect((await new Repo(db).load())?.settings).not.toHaveProperty('paySchedule');
  });

  test('money stays integer cents in the columns', async () => {
    const db = nodeDb();
    await migrate(db);
    await new Repo(db).save(stored());
    const row = db.raw
      .prepare('SELECT amount, typeof(amount) AS kind FROM transactions LIMIT 1')
      .get();
    expect(row).toMatchObject({ kind: 'integer' });
  });

  test('a save only writes rows that changed, and removes rows that are gone', async () => {
    const db = nodeDb();
    await migrate(db);
    const repo = new Repo(db);
    await repo.save(stored());
    await repo.load();
    db.statements.length = 0;

    const next = stored();
    next.transactions = next.transactions.map((t, i) =>
      i === 0 ? { ...t, reviewed: true, category: 'Software' } : t,
    );
    next.bills = next.bills.slice(1);
    next.settings = { ...next.settings, taxRate: 0.25 };
    expect(await repo.save(next)).toBe(3);
    expect(db.statements).toEqual([
      'INSERT INTO transactions',
      'DELETE FROM bills',
      'INSERT INTO settings',
    ]);
    expect(await repo.save(next)).toBe(0);

    const loaded = await new Repo(db).load();
    expect(loaded?.bills).toHaveLength(stored().bills.length - 1);
    expect(loaded?.settings.taxRate).toBe(0.25);
    expect(loaded?.transactions[0].category).toBe('Software');
  });

  test('a save that fails part way leaves the file as it was', async () => {
    const db = nodeDb();
    await migrate(db);
    const repo = new Repo(db);
    await repo.save(stored());
    const broken = stored();
    broken.accounts = [...broken.accounts, { ...broken.accounts[0], id: 'x', type: null as never }];
    broken.settings = { ...broken.settings, taxRate: 0.35 };
    await expect(repo.save(broken)).rejects.toThrow();
    expect((await new Repo(db).load())?.settings.taxRate).toBe(stored().settings.taxRate);
  });

  test('clear empties every table', async () => {
    const db = nodeDb();
    await migrate(db);
    const repo = new Repo(db);
    await repo.save(stored());
    await repo.clear();
    expect(await repo.load()).toBeNull();
    expect(db.raw.prepare('SELECT count(*) AS n FROM transactions').get()).toEqual({ n: 0 });
  });
});
