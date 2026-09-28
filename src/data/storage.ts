/**
 * Where Annum's data lives on the phone (docs/02 "Storage & security"):
 * - One SQLCipher-encrypted file, Documents/SQLite/annum.db. iCloud device backups include it,
 *   still encrypted.
 * - Its 256-bit key in the iOS Keychain, "this device only": it never leaves the phone, so a
 *   new phone needs an Annum backup file (Settings → Export all data).
 * Every database call goes through one queue, so a save never overlaps a backup or a wipe.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { openEncryptedDatabase } from './db';
import { Repo, TABLE_NAMES, type BankConnection, type Stored } from './repo';
import { migrate, NewerSchemaError, SCHEMA_VERSION, type Db } from './schema';
import { createDatabaseKey, deleteAllSecrets, readDatabaseKey } from './secure';

export const DB_NAME = 'annum.db';
const RESTORE_NAME = 'annum-restore.annum';
/** Backups are named for the day they were made: annum-backup-2026-09-25.annum */
export const BACKUP_PREFIX = 'annum-backup-';

let open: { db: SQLite.SQLiteDatabase; repo: Repo } | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Run database work one piece at a time, in order. */
export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const dbFile = () => new File(`file://${SQLite.defaultDatabaseDirectory as string}`, DB_NAME);
const pathOf = (item: { uri: string }) => decodeURIComponent(item.uri.replace(/^file:\/\//, ''));
/** SQL string literal (for the few statements that can't take bound parameters). */
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const databaseExists = (): boolean => dbFile().exists;

export type OpenResult =
  | { kind: 'ok'; stored: Stored | null }
  | { kind: 'key-missing' }
  | { kind: 'newer' }
  | { kind: 'cant-open' };

/**
 * Open (or, with `create`, start) the encrypted file and bring its schema up to date.
 * "key-missing": the file is here but its key isn't (e.g. restored onto a new phone).
 */
export function openStorage(create: boolean): Promise<OpenResult> {
  return exclusive(async () => {
    if (open) return { kind: 'ok', stored: await open.repo.load() };
    const exists = databaseExists();
    let key = await readDatabaseKey();
    if (!key) {
      if (exists) return { kind: 'key-missing' };
      if (!create) return { kind: 'ok', stored: null };
      key = await createDatabaseKey();
    }
    if (!exists && !create) return { kind: 'ok', stored: null };
    let db: SQLite.SQLiteDatabase;
    try {
      db = await openEncryptedDatabase(DB_NAME, key);
    } catch {
      return { kind: 'cant-open' };
    }
    try {
      await migrate(db as unknown as Db);
    } catch (e) {
      await db.closeAsync();
      return e instanceof NewerSchemaError ? { kind: 'newer' } : { kind: 'cant-open' };
    }
    const repo = new Repo(db as unknown as Db);
    open = { db, repo };
    return { kind: 'ok', stored: await repo.load() };
  });
}

export const isOpen = (): boolean => open !== null;

/** Close the file (development checks simulate a fresh start with it). */
export function closeStorage(): Promise<void> {
  return exclusive(async () => {
    if (open) {
      await open.db.closeAsync().catch(() => undefined);
      open = null;
    }
  });
}

/**
 * Save one bank connection right away, even during setup (the file is created if it has to
 * be): a connection can't be made again, so it's never left only in memory.
 */
export function putConnection(c: BankConnection): Promise<void> {
  return openStorage(true).then((r) => {
    if (r.kind !== 'ok') throw new Error(`Storage ${r.kind}`);
    return exclusive(async () => open?.repo.putConnection(c));
  });
}

export function deleteConnection(itemId: string): Promise<void> {
  return exclusive(async () => open?.repo.deleteConnection(itemId));
}

/** Connections saved before setup finished (null if there's no database yet). */
export function loadConnections(): Promise<BankConnection[]> {
  return exclusive(async () => (open ? open.repo.loadConnections() : []));
}

export function save(stored: Stored): Promise<number> {
  return exclusive(async () => (open ? open.repo.save(stored) : 0));
}

/** Delete everything: the database file, the Keychain entries, and files Annum wrote. */
export function wipeStorage(options: { keepPairing?: boolean } = {}): Promise<void> {
  return exclusive(async () => {
    if (open) {
      await open.db.closeAsync().catch(() => undefined);
      open = null;
    }
    await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => undefined);
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const side = new File(
        `file://${SQLite.defaultDatabaseDirectory as string}`,
        DB_NAME + suffix,
      );
      if (side.exists) side.delete();
    }
    await deleteAllSecrets(options);
    clearExportedFiles();
  });
}

/** Tax exports, PDFs, backups, picked files, and bank files opened with "Open in Annum". */
export function clearExportedFiles(): void {
  const cache = new Directory(Paths.cache);
  if (cache.exists) {
    for (const item of cache.list()) {
      if (item instanceof File && item.name.startsWith('annum-')) item.delete();
      if (item instanceof Directory && ['Print', 'DocumentPicker'].includes(item.name)) {
        item.delete();
      }
    }
  }
  const inbox = new Directory(Paths.document, 'Inbox');
  if (inbox.exists) inbox.delete();
}

/**
 * Export all data: a copy of the database, encrypted with a passphrase the user chooses
 * (SQLCipher derives the key from it with PBKDF2, 256,000 rounds). Returns the file.
 */
export function writeBackup(passphrase: string, today: string): Promise<File> {
  return exclusive(async () => {
    if (!open) throw new Error('Storage is not open');
    const file = new File(Paths.cache, `${BACKUP_PREFIX}${today}.annum`);
    if (file.exists) file.delete();
    const { db } = open;
    await db.execAsync(
      `ATTACH DATABASE ${literal(pathOf(file))} AS backup KEY ${literal(passphrase)}`,
    );
    try {
      await db.getFirstAsync("SELECT sqlcipher_export('backup')");
      await db.execAsync(`PRAGMA backup.user_version = ${SCHEMA_VERSION}`);
    } finally {
      await db.execAsync('DETACH DATABASE backup');
    }
    return file;
  });
}

export type RestoreResult =
  | { kind: 'ok'; stored: Stored }
  | { kind: 'wrong-passphrase' }
  | { kind: 'newer' }
  | { kind: 'not-a-backup' };

/**
 * Import backup: check the file opens with the passphrase and bring it up to this version's
 * schema (working on a copy), then replace everything in this phone's database with it.
 */
export function restoreBackup(pickedUri: string, passphrase: string): Promise<RestoreResult> {
  return exclusive(async () => {
    const copy = new File(Paths.cache, RESTORE_NAME);
    if (copy.exists) copy.delete();
    new File(pickedUri).copy(copy);
    try {
      const check = await checkBackup(copy, passphrase);
      if (check !== 'ok') return { kind: check };

      if (!open) {
        const key = (await readDatabaseKey()) ?? (await createDatabaseKey());
        const db = await openEncryptedDatabase(DB_NAME, key);
        await migrate(db as unknown as Db);
        open = { db, repo: new Repo(db as unknown as Db) };
      }
      const { db } = open;
      await db.execAsync(
        `ATTACH DATABASE ${literal(pathOf(copy))} AS restore KEY ${literal(passphrase)}`,
      );
      try {
        await db.withTransactionAsync(async () => {
          for (const name of TABLE_NAMES) {
            await db.execAsync(`DELETE FROM main.${name}`);
            await db.execAsync(`INSERT INTO main.${name} SELECT * FROM restore.${name}`);
          }
        });
      } finally {
        await db.execAsync('DETACH DATABASE restore');
      }
      open.repo = new Repo(db as unknown as Db);
      const stored = await open.repo.load();
      return stored ? { kind: 'ok', stored } : { kind: 'not-a-backup' };
    } finally {
      if (copy.exists) copy.delete();
    }
  });
}

async function checkBackup(
  file: File,
  passphrase: string,
): Promise<'ok' | 'wrong-passphrase' | 'newer' | 'not-a-backup'> {
  const dir = pathOf(new Directory(Paths.cache));
  // A connection of its own: expo-sqlite otherwise reuses an open one to the same path, which
  // may already carry a key, so a wrong passphrase could look like "not a backup".
  const db = await SQLite.openDatabaseAsync(file.name, { useNewConnection: true }, dir);
  try {
    await db.execAsync(`PRAGMA key = ${literal(passphrase)}`);
    try {
      await db.getFirstAsync('SELECT count(*) FROM sqlite_master');
    } catch {
      return 'wrong-passphrase';
    }
    try {
      await migrate(db as unknown as Db);
    } catch (e) {
      return e instanceof NewerSchemaError ? 'newer' : 'not-a-backup';
    }
    const started = await db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM meta WHERE key = 'startedOn'",
    );
    return started?.n ? 'ok' : 'not-a-backup';
  } finally {
    await db.closeAsync();
  }
}
