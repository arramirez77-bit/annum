import { demoScenario, demoSeed } from '@/data/demo';
import {
  availableToSpend,
  estimatedRunwayMonths,
  learnedMonthlySpend,
  newAppData,
  nextIncome,
  nextPayday,
  nextQuarterlyDue,
  reviewWeekStart,
  taxSummary,
  taxYearFrom,
  weekStartSnapshot,
  weekSummaryFrom,
  withDerived,
  type Account,
  type Transaction,
} from '@/domain';

const seed = demoSeed();

const tx = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}) =>
  ({
    id,
    accountId: 'chk',
    date,
    merchant: id,
    amount,
    tax: false,
    reviewed: true,
    ...extra,
  }) as Transaction;

describe('paydays roll forward', () => {
  test('biweekly steps 14 days at a time until on or after today', () => {
    const pay = { amount: 250000, cadence: 'biweekly' as const, next: '2026-09-07' };
    expect(nextPayday(pay, '2026-09-07')).toBe('2026-09-07'); // payday itself counts
    expect(nextPayday(pay, '2026-09-08')).toBe('2026-09-21');
    expect(nextPayday(pay, '2026-09-25')).toBe('2026-10-05');
  });

  test('monthly keeps the day of month instead of drifting after a short month', () => {
    const pay = { amount: 1, cadence: 'monthly' as const, next: '2026-01-31' };
    expect(nextPayday(pay, '2026-02-01')).toBe('2026-02-28');
    expect(nextPayday(pay, '2026-03-01')).toBe('2026-03-31');
  });

  test('salary scenario still pays on Oct 5', () => {
    expect(nextIncome(demoScenario('salary')).date).toBe('2026-10-05');
  });

  test('Both: the paycheck wins when it comes before the invoice', () => {
    const both = {
      ...seed,
      settings: {
        ...seed.settings,
        incomeType: 'both' as const,
        paySchedule: { amount: 100000, cadence: 'biweekly' as const, next: '2026-10-02' },
      },
    };
    expect(nextIncome(both)).toMatchObject({ kind: 'paycheck', date: '2026-10-02' });
    const later = {
      ...both,
      settings: {
        ...both.settings,
        paySchedule: { ...both.settings.paySchedule, next: '2026-10-20' },
      },
    };
    expect(nextIncome(later)).toMatchObject({ kind: 'expected', date: '2026-10-13' });
  });
});

describe('derived from transactions (real mode)', () => {
  test('IRS quarterly dates: next on or after today, Jan 15 after Sep 15', () => {
    expect(nextQuarterlyDue('2026-09-24')).toBe('2027-01-15');
    expect(nextQuarterlyDue('2026-09-15')).toBe('2026-09-15');
    expect(nextQuarterlyDue('2026-05-01')).toBe('2026-06-15');
  });

  test('review week starts at the last review, or covers the last 7 days before the first', () => {
    expect(reviewWeekStart('2026-09-24')).toBe('2026-09-18');
    expect(
      reviewWeekStart('2026-09-24', { date: '2026-09-20', availableToSpend: 0, runway: 0 }),
    ).toBe('2026-09-20');
  });

  test('this week: spending by category, transfers and pending charges left out', () => {
    const transactions = [
      tx('a', '2026-09-21', -8000, { category: 'Groceries' }),
      tx('b', '2026-09-22', -1500, { category: 'Dining' }),
      tx('c', '2026-09-22', -100000, { category: 'Transfer' }),
      tx('d', '2026-09-23', -900, { category: 'Dining', pending: true }),
      tx('e', '2026-09-01', -4000, { category: 'Groceries' }),
    ];
    const week = weekSummaryFrom(transactions, '2026-09-20', '2026-09-24');
    expect(week).toEqual({
      start: '2026-09-20',
      spent: 9500,
      byCategory: { Groceries: 8000, Dining: 1500 },
      fourWeekAvg: { Groceries: 1000 },
    });
  });

  test('tax year: tagged spending this year by tax category, with item counts', () => {
    const transactions = [
      tx('a', '2026-03-02', -120000, { tax: true, taxCategory: 'Equipment' }),
      tx('b', '2026-09-21', -2000, { tax: true, category: 'Software' }),
      tx('c', '2026-09-22', -2000, { tax: true, category: 'Software' }),
      tx('d', '2025-12-30', -5000, { tax: true, category: 'Software' }),
      tx('e', '2026-09-22', -3000, { category: 'Dining' }),
    ];
    const year = taxYearFrom(transactions, '2026-09-24');
    expect(year).toEqual({
      year: 2026,
      byCategory: { Equipment: 120000, Software: 4000 },
      itemsByCategory: { Equipment: 1, Software: 2 },
      nextQuarterlyDue: '2027-01-15',
    });
    expect(taxSummary({ ...seed, taxYear: year }).total).toBe(124000);
  });

  test('monthly spending is learned from 90 days once there are 30 days of history', () => {
    const short = [tx('a', '2026-09-10', -300000, { category: 'Rent' })];
    expect(learnedMonthlySpend(short, '2026-09-24')).toBeUndefined();
    const history = [
      tx('a', '2026-06-27', -300000, { category: 'Rent' }),
      tx('b', '2026-07-27', -300000, { category: 'Rent' }),
      tx('c', '2026-08-27', -300000, { category: 'Rent' }),
      tx('d', '2026-09-01', 500000, { category: 'Income' }),
    ];
    expect(learnedMonthlySpend(history, '2026-09-24')).toBe(300000);
  });

  test('withDerived replaces the fixture totals with ones computed from transactions', () => {
    const data = withDerived(seed);
    expect(data.taxYear?.byCategory).toEqual({ Software: 2000 }); // Litware, tagged
    expect(data.thisWeek?.start).toBe('2026-09-17');
  });

  test('the week-start snapshot records ATS and Runway at the review', () => {
    expect(weekStartSnapshot(seed)).toEqual({
      date: seed.today,
      availableToSpend: availableToSpend(seed).raw,
      runway: seed.buckets.runway,
    });
  });
});

describe('first run from onboarding answers', () => {
  const accounts: Account[] = [
    {
      id: 'chk',
      name: 'Checking',
      type: 'checking',
      balance: 380000,
      source: 'manual',
      status: 'ok',
    },
    {
      id: 'sav',
      name: 'Savings',
      type: 'savings',
      balance: 1910000,
      source: 'manual',
      status: 'ok',
    },
  ];

  test('freelance: estimate mode, unsplit savings, Tax on, 30%, target 5 months', () => {
    const data = newAppData({
      today: '2026-09-25',
      incomeType: 'freelance',
      accounts,
      monthlySpend: 300000,
      expectedIncome: [
        { id: 'i1', source: 'Northwind Studio', amount: 500000, date: '2026-10-13' },
      ],
    });
    expect(data.settings).toMatchObject({
      isEstimate: true,
      taxRate: 0.3,
      runwayTarget: 1500000,
      modules: { tax: true, debt: false, invest: true },
    });
    expect(data.savingsUnsplit).toBe(true);
    expect(data.buckets).toEqual({ tax: 0, bills: 0, runway: 0, invest: 0, free: 0 });
    expect(estimatedRunwayMonths(data)).toBe(6);
    expect(availableToSpend(data, 0)).toMatchObject({ raw: 380000, days: 18 });
  });

  test('salary: Tax off everywhere, paycheck is the next income', () => {
    const data = newAppData({
      today: '2026-09-25',
      incomeType: 'salary',
      accounts,
      monthlySpend: 250000,
      paySchedule: { amount: 250000, cadence: 'biweekly', next: '2026-10-05' },
    });
    expect(data.settings.modules.tax).toBe(false);
    expect(data.settings.taxRate).toBe(0);
    expect(nextIncome(data)).toMatchObject({ kind: 'paycheck', date: '2026-10-05' });
  });

  test('no monthly spending typed and no history: 0 until learned', () => {
    const data = newAppData({ today: '2026-09-25', incomeType: 'freelance', accounts });
    expect(data.settings.monthlySpend).toBe(0);
    expect(estimatedRunwayMonths(data)).toBe(0);
  });
});
