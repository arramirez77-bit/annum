/**
 * M5 check (development builds, Spikes screen): Export all data → Import backup on the real
 * storage code, without the share sheet or Files picker. Changes one number after exporting,
 * then shows a wrong passphrase changes nothing and the right one brings the number back.
 * Loaded with a dynamic import; never part of release screens.
 */
import { File, Paths } from 'expo-file-system';

import { deleteDatabaseKey } from '@/data/secure';
import { closeStorage, wipeStorage, writeBackup } from '@/data/storage';
import { localISODate } from '@/domain';

import { boot, flushSaves, restoreFrom } from '../session';
import { useAppStore } from '../store';

export interface CheckStep {
  name: string;
  pass: boolean;
  detail: string;
}

const PASSPHRASE = 'annum-check-passphrase';
const SQLITE_HEADER = 'SQLite format 3\0';

export async function runBackupCheck(): Promise<CheckStep[]> {
  const steps: CheckStep[] = [];
  const add = (name: string, pass: boolean, detail: string) => steps.push({ name, pass, detail });
  const store = () => useAppStore.getState();

  if (store().mode !== 'real' || !store().loaded) {
    add('Your own data is open', false, 'Finish onboarding (or “Use my data”) first');
    return steps;
  }
  const before = store().data.settings.monthlySpend;

  await flushSaves();
  const file = await writeBackup(PASSPHRASE, localISODate(new Date()));
  const handle = file.open();
  const head = String.fromCharCode(...handle.readBytes(16));
  handle.close();
  add('Backup file written', (file.size ?? 0) > 0, `${file.size ?? 0} bytes`);
  add('File is encrypted', head !== SQLITE_HEADER, 'No plain SQLite header');

  store().setNumbers({ monthlySpend: before + 10000 });
  await flushSaves();
  const wrong = await restoreFrom(file.uri, 'not-the-passphrase');
  add(
    'Wrong passphrase changes nothing',
    wrong === 'wrong-passphrase' && store().data.settings.monthlySpend === before + 10000,
    wrong,
  );

  const right = await restoreFrom(file.uri, PASSPHRASE);
  add(
    'Right passphrase restores',
    right === 'ok' && store().data.settings.monthlySpend === before,
    `${right}; monthly spending back to the exported value`,
  );
  if (file.exists) file.delete();

  // The next two erase this phone's data first, so they only run on the sample bank's
  // made-up numbers — never on real accounts.
  if (!store().data.accounts.some((a) => a.source === 'demo')) {
    add('New phone and missing key', true, 'Skipped: needs the sample bank (erases data)');
    return steps;
  }
  const expected = store().data.settings.monthlySpend;
  const today = localISODate(new Date());
  // Keep the backup outside the cache: Delete everything clears exported files there.
  const kept = new File(Paths.document, 'check-backup.annum');
  if (kept.exists) kept.delete();
  (await writeBackup(PASSPHRASE, today)).move(kept);

  // New phone: no database, no key, first-launch screens — then Restore from a backup.
  await wipeStorage();
  store().reset();
  const fresh = await restoreFrom(kept.uri, PASSPHRASE);
  add(
    'New phone: restore from Welcome',
    fresh === 'ok' && store().phase === 'ready' && store().data.settings.monthlySpend === expected,
    `${fresh}; ${store().data.accounts.length} accounts back`,
  );

  // Restored from iCloud: the file is here but its key isn't → the can't-open screen.
  await flushSaves();
  await closeStorage();
  await deleteDatabaseKey();
  await boot();
  const blocked = store().phase === 'blocked' && store().blocked === 'key-missing';
  const recovered = await restoreFrom(kept.uri, PASSPHRASE);
  add(
    'Key missing: calm screen, then restore',
    blocked && recovered === 'ok' && store().data.settings.monthlySpend === expected,
    `${blocked ? 'key-missing screen' : `phase ${store().phase}`}; ${recovered}`,
  );
  if (kept.exists) kept.delete();
  return steps;
}
