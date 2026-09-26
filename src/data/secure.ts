/**
 * The only place secrets are read or written (docs/02 "Storage & security"). Secrets live in
 * the iOS Keychain, this device only. Never log them.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DB_KEY = 'annum.db.key.v1';

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

/** "Delete everything" removes the key with the data (M5). */
export const deleteDatabaseKey = (): Promise<void> => SecureStore.deleteItemAsync(DB_KEY);
