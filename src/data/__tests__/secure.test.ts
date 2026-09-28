/**
 * The Worker access key stays in memory once read, so background refresh (which runs while the
 * phone is locked, when the Keychain item can't be read) can still reach the Worker.
 */
import { deleteAllSecrets, readWorkerKey, saveWorkerKey } from '../secure';

const mockKeychain = new Map<string, string>();
let mockLocked = false;
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: jest.fn(async (k: string) => {
    if (mockLocked) throw new Error('User interaction is not allowed.');
    return mockKeychain.get(k) ?? null;
  }),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (mockLocked) throw new Error('User interaction is not allowed.');
    mockKeychain.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockKeychain.delete(k);
  }),
}));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: jest.fn() }));

afterEach(() => {
  mockLocked = false;
});

describe('Worker access key', () => {
  it('is read while unlocked and still there while the phone is locked', async () => {
    await saveWorkerKey('k'.repeat(43));
    mockLocked = true;
    expect(await readWorkerKey()).toBe('k'.repeat(43));
  });

  it('is gone from memory too after Delete everything, unless pairing is kept', async () => {
    await saveWorkerKey('k'.repeat(43));
    await deleteAllSecrets({ keepPairing: true });
    expect(await readWorkerKey()).toBe('k'.repeat(43));
    await deleteAllSecrets();
    expect(await readWorkerKey()).toBeNull();
  });
});
