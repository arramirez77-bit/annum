/**
 * Encrypted SQLite (expo-sqlite built with SQLCipher via the config plugin `useSQLCipher`).
 * The key is applied first with `PRAGMA key`, as a raw 32-byte key in hex, so SQLCipher skips
 * its passphrase derivation. Schema and migrations arrive in M5.
 */
import * as SQLite from 'expo-sqlite';

const HEX_KEY = /^[0-9a-f]{64}$/;

export async function openEncryptedDatabase(
  name: string,
  keyHex: string,
): Promise<SQLite.SQLiteDatabase> {
  if (!HEX_KEY.test(keyHex)) throw new Error('Database key must be 32 bytes, hex encoded');
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync(`PRAGMA key = "x'${keyHex}'";`);
  // Touching the schema proves the key is right: a wrong key throws "file is not a database".
  await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master;');
  return db;
}

/** The linked SQLCipher version; null means plain SQLite (encryption would silently be off). */
export async function cipherVersion(db: SQLite.SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version;');
  return row?.cipher_version ?? null;
}
