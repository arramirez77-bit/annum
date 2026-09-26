/**
 * M0.5 spike: prove the database is really encrypted (see SPIKES.md). Development builds only.
 * Loaded with a dynamic import so builds without expo-sqlite never evaluate it at startup.
 */
import * as SQLite from 'expo-sqlite';

import { cipherVersion, openEncryptedDatabase } from '../db';
import { getOrCreateDatabaseKey, toHex } from '../secure';

export interface SpikeStep {
  name: string;
  pass: boolean;
  detail: string;
}

const NAME = 'annum-spike.db';

async function expectFailure(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function runSqlcipherSpike(): Promise<{ steps: SpikeStep[]; path: string }> {
  const steps: SpikeStep[] = [];
  const add = (name: string, pass: boolean, detail: string) => steps.push({ name, pass, detail });

  const key = await getOrCreateDatabaseKey();
  add('Key in Keychain', /^[0-9a-f]{64}$/.test(key), '32 random bytes, this device only');

  await SQLite.deleteDatabaseAsync(NAME).catch(() => undefined);
  const db = await openEncryptedDatabase(NAME, key);
  const version = await cipherVersion(db);
  add('SQLCipher linked', !!version, version ? `cipher_version ${version}` : 'plain SQLite');

  await db.execAsync('CREATE TABLE sample (id INTEGER PRIMARY KEY, amount INTEGER NOT NULL);');
  await db.runAsync('INSERT INTO sample (amount) VALUES (?), (?);', 12345, 67);
  const row = await db.getFirstAsync<{ total: number }>('SELECT sum(amount) AS total FROM sample;');
  add('Write and read with key', row?.total === 12412, `sum = ${row?.total ?? 'none'}`);
  const path = db.databasePath;
  await db.closeAsync();

  const noKey = await expectFailure(async () => {
    const plain = await SQLite.openDatabaseAsync(NAME);
    try {
      await plain.getFirstAsync('SELECT count(*) FROM sqlite_master;');
    } finally {
      await plain.closeAsync();
    }
  });
  add('Unreadable without key', !!noKey, noKey ?? 'opened without a key');

  const wrongKey = await expectFailure(async () => {
    const other = await openEncryptedDatabase(NAME, toHex(new Uint8Array(32).fill(7)));
    await other.closeAsync();
  });
  add('Unreadable with wrong key', !!wrongKey, wrongKey ?? 'opened with the wrong key');

  const again = await openEncryptedDatabase(NAME, key);
  const reread = await again.getFirstAsync<{ total: number }>(
    'SELECT sum(amount) AS total FROM sample;',
  );
  add('Reopens with the right key', reread?.total === 12412, `sum = ${reread?.total ?? 'none'}`);
  await again.closeAsync();

  return { steps, path };
}
