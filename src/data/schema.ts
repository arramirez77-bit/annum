/**
 * Database schema and migrations (docs/02 "Storage & security"). Each migration runs once, in
 * order, inside a transaction; `PRAGMA user_version` records how far the file has come.
 *
 * Rows keep the whole domain object as JSON in `body` (integer cents stay integers), plus the
 * columns worth indexing. Never add a migration's SQL to an old entry: append a new one.
 */

/** The small part of expo-sqlite's database API the data layer uses (also met by tests). */
export type Bind = string | number | null;
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Bind[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const MIGRATIONS: readonly string[] = [
  // 1 — first schema (M5)
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, source TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, date TEXT NOT NULL,
    amount INTEGER NOT NULL, external_id TEXT, body TEXT NOT NULL);
  CREATE INDEX transactions_date ON transactions (date);
  CREATE UNIQUE INDEX transactions_external ON transactions (account_id, external_id)
    WHERE external_id IS NOT NULL;
  CREATE TABLE bills (id TEXT PRIMARY KEY NOT NULL, due TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE expected_income (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE deposits (
    id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, confirmed INTEGER NOT NULL, body TEXT NOT NULL);
  CREATE TABLE splits (
    id TEXT PRIMARY KEY NOT NULL, deposit_id TEXT, date TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE reviews (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE rules (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);
  CREATE TABLE deferred (
    id TEXT PRIMARY KEY NOT NULL, wait_until TEXT NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Thrown when the file was written by a newer Annum than this one. */
export class NewerSchemaError extends Error {
  constructor(readonly found: number) {
    super(`Schema ${found} is newer than ${SCHEMA_VERSION}`);
    this.name = 'NewerSchemaError';
  }
}

export async function schemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/** Bring the file up to SCHEMA_VERSION. Returns the version it started at. */
export async function migrate(db: Db): Promise<number> {
  const start = await schemaVersion(db);
  if (start > SCHEMA_VERSION) throw new NewerSchemaError(start);
  for (let v = start; v < SCHEMA_VERSION; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return start;
}
