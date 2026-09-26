import { demoScenario, demoSeed } from '@/data/demo';
import {
  availableToSpend,
  headsUpCauses,
  nextIncome,
  NO_INCOME_HORIZON_DAYS,
  perDayFor,
  runwayMonths,
  shouldOfferLowerHabit,
  staleAccounts,
  todayStatus,
  weeklyTransfer,
  whatIf,
  type AppData,
} from '@/domain';

const seed = demoSeed();
const withChecking = (data: AppData, balance: number): AppData => ({
  ...data,
  accounts: data.accounts.map((a) => (a.type === 'checking' ? { ...a, balance } : a)),
});

describe('next income', () => {
  test('no expected income: plans over a 30-day horizon and says so', () => {
    const data: AppData = { ...seed, expectedIncome: [] };
    const income = nextIncome(data);
    expect(income).toEqual({ date: '2026-10-23', kind: 'none' });
    expect(availableToSpend(data).days).toBe(NO_INCOME_HORIZON_DAYS);
  });

  test('income due today: per day divides by 1 day, never 0', () => {
    const data: AppData = { ...seed, today: '2026-10-13' };
    const ats = availableToSpend(data);
    expect(ats.nextIncome.kind).toBe('expected');
    expect(ats.days).toBe(0);
    expect(ats.perDay).toBe(ats.raw - (ats.raw % 100));
    expect(Number.isFinite(ats.perDay)).toBe(true);
  });

  test('a late invoice gives way to another income due sooner', () => {
    const data: AppData = {
      ...seed,
      today: '2026-10-17',
      expectedIncome: [
        ...seed.expectedIncome,
        { id: 'i2', source: 'Another client', amount: 100000, date: '2026-10-19' },
      ],
    };
    expect(nextIncome(data)).toMatchObject({ kind: 'expected', date: '2026-10-19' });
  });

  test('late invoice reports how late it is', () => {
    expect(nextIncome(demoScenario('late-invoice'))).toMatchObject({
      kind: 'late',
      dueDate: '2026-10-13',
      daysLate: 4,
    });
  });

  test('received income is ignored', () => {
    const data: AppData = {
      ...seed,
      expectedIncome: seed.expectedIncome.map((i) => ({ ...i, received: true })),
    };
    expect(nextIncome(data).kind).toBe('none');
  });

  test('salary uses the pay schedule', () => {
    expect(nextIncome(demoScenario('salary'))).toMatchObject({
      kind: 'paycheck',
      date: '2026-10-05',
      amount: 250000,
    });
  });
});

describe('Available to Spend', () => {
  test('negative ATS: display floors at $0, raw keeps the real value, status heads-up', () => {
    const data = withChecking(seed, 50000);
    const ats = availableToSpend(data);
    expect(ats.raw).toBe(-50000);
    expect(ats.display).toBe(0);
    expect(ats.perDay).toBe(0);
    expect(todayStatus(data)).toBe('heads-up');
  });

  test('lists what it subtracted, in date order', () => {
    expect(availableToSpend(seed).obligations.map((o) => [o.kind, o.name, o.amount])).toEqual([
      ['statement', 'Contoso Card', 50000],
      ['bill', 'Car insurance', 15000],
      ['bill', 'Phone', 5000],
      ['bill', 'Rent', 160000],
      ['bill', 'Utilities', 12000],
      ['bill', 'Internet', 8000],
    ]);
  });

  test('unconfirmed bills and paid ($0) statements are not subtracted', () => {
    const data: AppData = {
      ...seed,
      bills: seed.bills.map((b) => ({ ...b, confirmed: false })),
      accounts: seed.accounts.map((a) => (a.type === 'card' ? { ...a, statementBalance: 0 } : a)),
    };
    expect(availableToSpend(data).raw).toBe(200000 + 150000);
  });

  test('per day rounds down to whole dollars', () => {
    expect(perDayFor(110000, 12)).toBe(9100);
    expect(perDayFor(-100, 5)).toBe(0);
  });

  test('runway months is 0 when monthly spend is unknown', () => {
    expect(runwayMonths({ ...seed, settings: { ...seed.settings, monthlySpend: 0 } })).toBe(0);
  });
});

describe('status', () => {
  test('heads-up names its causes', () => {
    expect(headsUpCauses(demoScenario('heads-up')).map((c) => c.kind)).toEqual([
      'statement-before-income',
      'low-per-day',
    ]);
    expect(headsUpCauses(demoScenario('late-invoice'))[0]).toMatchObject({
      kind: 'late-income',
      daysLate: 4,
    });
    expect(headsUpCauses(seed)).toEqual([]);
  });

  test('estimate wins over heads-up while isEstimate is on', () => {
    const data = withChecking({ ...seed, settings: { ...seed.settings, isEstimate: true } }, 0);
    expect(todayStatus(data)).toBe('estimate');
  });

  test('manual accounts are never stale; synced ones are after 48 hours', () => {
    // Seed accounts synced Sep 23, 7:02 AM; the loan is entered by hand.
    const justUnder = new Date('2026-09-25T07:01:00');
    expect(staleAccounts(seed, justUnder).map((a) => a.id)).toEqual([]);
    const later = new Date('2026-09-25T07:03:00');
    expect(staleAccounts(seed, later).map((a) => a.id)).toEqual(['chk', 'sav', 'card']);
  });
});

describe('what if and transfer', () => {
  test('what if with nothing spendable takes the whole purchase from Runway', () => {
    const w = whatIf(withChecking(seed, 0), 10000);
    expect(w.shortfall).toBe(10000);
    expect(w.guardrail).toBe(true);
    expect(w.waitUntil).toBe('2026-10-13');
  });

  test('transfer lists what falls in the next 7 days (inclusive)', () => {
    const t = weeklyTransfer(seed);
    expect(t.due.map((o) => o.name)).toEqual(['Contoso Card', 'Car insurance', 'Phone']);
    expect([t.spending, t.total, t.habit, t.difference]).toEqual([35000, 105000, 100000, 5000]);
  });

  test('offer to lower the habit only after 3 weeks in a row below it', () => {
    expect(shouldOfferLowerHabit([90000, 95000, 99000], 100000)).toBe(true);
    expect(shouldOfferLowerHabit([90000, 105000, 99000], 100000)).toBe(false);
    expect(shouldOfferLowerHabit([90000, 95000], 100000)).toBe(false);
  });
});
