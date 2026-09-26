import { demoSeed } from '@/data/demo';
import { DEFAULT_PREFS } from '@/data/repo';
import { availableToSpend, newAppData } from '@/domain';

import { LOCK_AFTER_MS, shouldRelock } from '../lock-rules';
import {
  depositsWith,
  lastReviewDate,
  persistedFrom,
  storedFrom,
  type Persisted,
} from '../persist';

const seed = demoSeed();
const persisted = (): Persisted => ({
  data: seed,
  prefs: DEFAULT_PREFS,
  deposits: [],
  splits: [],
  reviews: [{ id: 'review-2026-09-20', date: '2026-09-20' }],
  rules: [],
  deferred: [],
  reviewStep: 3,
  pendingTransfer: { amount: 105000, markedOn: '2026-09-23' },
  startedOn: '2026-09-01',
});

describe('saving and loading the app state', () => {
  test('a save then a load gives the same numbers on Today', () => {
    const back = persistedFrom(storedFrom(persisted()), seed.today);
    expect(back.data.accounts).toEqual(seed.accounts);
    expect(back.data.buckets).toEqual(seed.buckets);
    expect(back.data.settings).toEqual(seed.settings);
    expect(back.reviewStep).toBe(3);
    expect(back.pendingTransfer).toEqual({ amount: 105000, markedOn: '2026-09-23' });
    expect(availableToSpend(back.data).display).toBe(availableToSpend(seed).display);
  });

  test('the current deposit is saved with the history and comes back as the current one', () => {
    const stored = storedFrom(persisted());
    expect(stored.deposits).toEqual([seed.pendingDeposit]);
    expect(persistedFrom(stored, seed.today).data.pendingDeposit).toEqual(seed.pendingDeposit);
  });

  test('loading on a later day moves "today" and recomputes this week from transactions', () => {
    const back = persistedFrom(storedFrom(persisted()), '2026-09-30');
    expect(back.data.today).toBe('2026-09-30');
    expect(back.data.thisWeek?.start).toBe(seed.weekStart?.date);
    expect(back.data.taxYear?.year).toBe(2026);
  });

  test('a new user with no onboarding date saves today as the start', () => {
    const fresh = {
      ...persisted(),
      startedOn: null,
      data: newAppData({ today: '2026-09-25', incomeType: 'salary', accounts: [] }),
    };
    expect(storedFrom(fresh).startedOn).toBe('2026-09-25');
  });

  test('deposit history: the current deposit replaces its older copy, or is added', () => {
    const d = { id: 'd1', date: '2026-09-23', amount: 100, confirmed: false };
    expect(depositsWith([d], { ...d, confirmed: true })).toEqual([{ ...d, confirmed: true }]);
    expect(depositsWith([], d)).toEqual([d]);
    expect(depositsWith([d])).toEqual([d]);
  });

  test('last review is the latest date', () => {
    expect(lastReviewDate([])).toBeNull();
    expect(
      lastReviewDate([
        { id: 'a', date: '2026-09-13' },
        { id: 'b', date: '2026-09-20' },
      ]),
    ).toBe('2026-09-20');
  });
});

describe('Face ID lock timing', () => {
  const t0 = 1_000_000;
  test('locks again after 5 minutes in the background, not before', () => {
    expect(shouldRelock(true, t0, t0 + LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldRelock(true, t0, t0 + LOCK_AFTER_MS)).toBe(true);
  });
  test('never when the lock is off or the app never left', () => {
    expect(shouldRelock(false, t0, t0 + LOCK_AFTER_MS * 10)).toBe(false);
    expect(shouldRelock(true, null, t0)).toBe(false);
  });
});
