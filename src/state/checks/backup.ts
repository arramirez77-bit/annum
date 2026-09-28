/**
 * M5 check (development builds, Spikes screen): Export all data → Import backup on the real
 * storage code, without the share sheet or Files picker. Changes one number after exporting,
 * then shows a wrong passphrase changes nothing and the right one brings the number back.
 * M7: bank connections (with their access tokens) come back too, and a restored connection
 * syncs without a new one. Loaded with a dynamic import; never part of release screens.
 */
import { File, Paths } from 'expo-file-system';

import type { BankConnection } from '@/data/repo';
import { deleteDatabaseKey, readWorkerKey, saveWorkerKey } from '@/data/secure';
import {
  closeStorage,
  deleteConnection,
  putConnection,
  wipeStorage,
  writeBackup,
} from '@/data/storage';
import { localISODate } from '@/domain';

import { pairWith, syncAll } from '../bank';
import { boot, flushSaves, restoreFrom } from '../session';
import { localDateTime, useAppStore } from '../store';

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
  // Bank connections to look for after each restore: item and token, compared, never shown.
  const banks = store()
    .connections.filter((c) => c.status === 'ok' && c.accessToken)
    .map((c) => ({ itemId: c.itemId, token: c.accessToken }));
  const banksBack = () =>
    banks.every((b) =>
      store().connections.some((c) => c.itemId === b.itemId && c.accessToken === b.token),
    );
  const banksDetail = `${banks.length} bank connection${banks.length === 1 ? '' : 's'}, access included`;

  await flushSaves();
  const file = await writeBackup(PASSPHRASE, localISODate(new Date()));
  const handle = file.open();
  const head = String.fromCharCode(...handle.readBytes(16));
  handle.close();
  add('Backup file written', (file.size ?? 0) > 0, `${file.size ?? 0} bytes`);
  add('File is encrypted', head !== SQLITE_HEADER, 'No plain SQLite header');

  // A bank connected after this backup was made (a stand-in, removed below): a restore must
  // keep it, since it counts against the 10 and can't be made again.
  const later: BankConnection = {
    itemId: 'check-after-backup',
    institution: 'Check',
    env: 'sandbox',
    status: 'ok',
    accessToken: 'access-sandbox-check',
    cursor: 'check-cursor',
    createdAt: localISODate(new Date()) + 'T00:00:00',
  };
  store().saveConnection(later);
  await putConnection(later);

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
  if (banks.length) add('Bank connections come back', right === 'ok' && banksBack(), banksDetail);
  const survivor = store().connections.find((c) => c.itemId === later.itemId);
  add(
    'A bank connected after the backup is kept',
    right === 'ok' && survivor?.accessToken === later.accessToken && survivor?.cursor === null,
    survivor ? 'kept; its history comes in again' : 'dropped',
  );
  store().removeConnection(later.itemId);
  await deleteConnection(later.itemId);
  if (file.exists) file.delete();

  // The next two erase this phone's data first, so they only run on made-up numbers (the
  // sample bank, or only Sandbox test banks) — never on real or hand-entered accounts.
  const sandboxOnly =
    store().data.accounts.length > 0 &&
    store().data.accounts.every(
      (a) =>
        a.source === 'plaid' &&
        store().connections.some((c) => c.itemId === a.itemId && c.env === 'sandbox'),
    );
  if (!sandboxOnly && !store().data.accounts.some((a) => a.source === 'demo')) {
    add('New phone and missing key', true, 'Skipped: needs the sample bank (erases data)');
    return steps;
  }
  const expected = store().data.settings.monthlySpend;
  const today = localISODate(new Date());
  // Keep the backup outside the cache: Delete everything clears exported files there.
  const kept = new File(Paths.document, 'check-backup.annum');
  if (kept.exists) kept.delete();
  (await writeBackup(PASSPHRASE, today)).move(kept);

  // New phone: no database, no keys, first-launch screens — then Restore from a backup. Erasing
  // takes this device's Worker access key too (as Delete everything does), so it's held here, in
  // memory only, and handed back below the way scanning the QR code would.
  const pairing = await readWorkerKey();
  try {
    return await newPhoneAndMissingKey();
  } finally {
    if (pairing && !(await readWorkerKey())) await saveWorkerKey(pairing);
  }

  async function newPhoneAndMissingKey(): Promise<CheckStep[]> {
    await wipeStorage();
    store().reset();
    const fresh = await restoreFrom(kept.uri, PASSPHRASE);
    add(
      'New phone: restore from Welcome',
      fresh === 'ok' &&
        store().phase === 'ready' &&
        store().data.settings.monthlySpend === expected,
      `${fresh}; ${store().data.accounts.length} accounts back`,
    );
    if (banks.length) {
      add('New phone: bank connections back', fresh === 'ok' && banksBack(), banksDetail);
      // A new phone has no access key (never in a backup): it scans the code, then the restored
      // token works — a sync, and nothing like Link or a token exchange.
      const unpaired = (await readWorkerKey()) === null;
      const scanned = pairing ? await pairWith(pairing) : 'no key to scan';
      add(
        'New phone: scan the code again',
        unpaired && scanned === 'paired',
        `${unpaired ? 'no key after restore' : 'key survived the erase'}; ${scanned}`,
      );
      const started = localDateTime(new Date());
      await syncAll(); // the restore's own routine sync, if one is running
      await syncAll({ force: true });
      const synced = store().connections.filter((c) => banks.some((b) => b.itemId === c.itemId));
      add(
        'Restored bank syncs, no new connection',
        synced.length === banks.length &&
          store().connections.length === banks.length &&
          synced.every((c) => c.status === 'ok' && !!c.lastSynced && c.lastSynced >= started),
        `${synced.length} of ${banks.length} synced`,
      );
    }

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
}
