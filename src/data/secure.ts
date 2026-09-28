/**
 * The only place secrets are read or written (docs/02 "Storage & security"). Secrets live in
 * the iOS Keychain, this device only. Never log them.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DB_KEY = 'annum.db.key.v1';
/** "1" when the Face ID lock is on. Read before the database opens, so it lives here. */
const LOCK_KEY = 'annum.lock.v1';
/**
 * The Worker access key this phone scanned (`npm run worker:rotate-key`; development builds:
 * `worker:rotate-dev-key`). This device only, so
 * it's never in an iCloud backup or an Annum backup file (docs/02 "The Worker").
 */
const WORKER_KEY = 'annum.worker.key.v1';
/** A random id for this phone, sent to Plaid as `client_user_id` (no personal data). */
const PLAID_USER = 'annum.plaid.user.v1';

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export interface KeyOptions {
  /** Face ID / passcode before the key can be read (M5). Can't be exercised in the Simulator. */
  requireAuthentication?: boolean;
}

const storeOptions = (o: KeyOptions): SecureStore.SecureStoreOptions => ({
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: o.requireAuthentication ?? false,
  authenticationPrompt: 'Unlock Annum',
});

/** The 256-bit database key: created once from secure random bytes, then read from the Keychain. */
export async function getOrCreateDatabaseKey(options: KeyOptions = {}): Promise<string> {
  const opts = storeOptions(options);
  const existing = await SecureStore.getItemAsync(DB_KEY, opts);
  if (existing) return existing;
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DB_KEY, key, opts);
  return key;
}

/**
 * The database key, if this phone has one. Stored without a Face ID requirement on purpose:
 * expo-secure-store's Face ID option loses the item whenever Face ID changes (a new face, a
 * reset) and has no passcode fallback, which would lose every number. The app itself is gated
 * by Face ID with passcode fallback (services/lock.ts). Decision logged in PROGRESS.md (M5).
 */
export const readDatabaseKey = (): Promise<string | null> =>
  SecureStore.getItemAsync(DB_KEY, storeOptions({}));

export async function createDatabaseKey(): Promise<string> {
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DB_KEY, key, storeOptions({}));
  return key;
}

export const deleteDatabaseKey = (): Promise<void> => SecureStore.deleteItemAsync(DB_KEY);

export async function isLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(LOCK_KEY, storeOptions({}))) === '1';
}

export const setLockEnabled = (on: boolean): Promise<void> =>
  on
    ? SecureStore.setItemAsync(LOCK_KEY, '1', storeOptions({}))
    : SecureStore.deleteItemAsync(LOCK_KEY);

/**
 * The access key, kept in memory once read: background refresh runs while the phone is locked,
 * when the Keychain item ("when unlocked") can't be read. Never logged, never written elsewhere.
 */
let workerKey: string | null | undefined;

export async function readWorkerKey(): Promise<string | null> {
  if (workerKey !== undefined) return workerKey;
  workerKey = await SecureStore.getItemAsync(WORKER_KEY, storeOptions({}));
  return workerKey;
}

export async function saveWorkerKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(WORKER_KEY, key, storeOptions({}));
  workerKey = key;
}

export async function getOrCreatePlaidUserId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(PLAID_USER, storeOptions({}));
  if (existing) return existing;
  const id = `phone-${toHex(await Crypto.getRandomBytesAsync(16))}`;
  await SecureStore.setItemAsync(PLAID_USER, id, storeOptions({}));
  return id;
}

/**
 * Delete everything: every Keychain entry Annum wrote. Bank tokens live in the database (so
 * backups carry them); the Worker key goes too, so this phone scans a new code afterwards.
 */
export async function deleteAllSecrets(options: { keepPairing?: boolean } = {}): Promise<void> {
  await SecureStore.deleteItemAsync(DB_KEY);
  await SecureStore.deleteItemAsync(LOCK_KEY);
  // Development "start over" keeps the pairing so test runs don't need a new code each time.
  if (!options.keepPairing) {
    workerKey = undefined;
    await SecureStore.deleteItemAsync(WORKER_KEY);
  }
  await SecureStore.deleteItemAsync(PLAID_USER);
}
