import { bankProvider, manualProvider, SyncError } from '../provider';

describe('sync provider interface', () => {
  test('manual entry works offline and fetches nothing', async () => {
    expect(manualProvider.needsNetwork).toBe(false);
    await expect(manualProvider.listAccounts()).resolves.toEqual([]);
    await expect(manualProvider.listTransactions('x', '2026-09-01')).resolves.toEqual([]);
  });

  test('no bank provider is chosen yet', () => {
    expect(bankProvider).toBeNull();
  });

  test('sync problems carry a kind the screens can map to a calm state', () => {
    const e = new SyncError('needs-reauth', 'Bank A needs you to sign in again');
    expect(e).toBeInstanceOf(Error);
    expect(e.problem).toBe('needs-reauth');
  });
});
