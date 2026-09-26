import { demoScenario, demoSeed } from '@/data/demo';
import { DEFAULT_PREFS, REMINDERS_ON } from '@/data/repo';
import { newAppData } from '@/domain';

import { accountRow } from '../account-views';
import { buildTransactionDetail, buildTransactionsView } from '../review-views';
import { buildSettingsView, targetMonths, weeklyReminderLabel } from '../settings-views';
import { buildTodayView, compactSentence } from '../views';

const seed = demoSeed();
const now = new Date('2026-09-23T09:00:00');

describe('S3 Settings values', () => {
  test('your numbers read as sentences', () => {
    const v = buildSettingsView(seed, DEFAULT_PREFS);
    expect(v.numbers).toEqual({
      tax: '30%',
      runway: '$15,000 · 5 months',
      habit: '$1,000 weekly',
      spend: 'About $3,000',
      pay: 'Not set',
    });
    expect(v.showTax).toBe(true);
    expect(v.showPay).toBe(false);
    expect(buildSettingsView(demoScenario('salary'), DEFAULT_PREFS).numbers.pay).toBe(
      '$2,500 every 2 weeks',
    );
    expect(targetMonths(seed)).toBe(5);
  });

  test('salary: no Tax toggle and no tax rows', () => {
    const v = buildSettingsView(demoScenario('salary'), DEFAULT_PREFS);
    expect(v.taxToggle).toBe(false);
    expect(v.showTax).toBe(false);
  });

  test('weekly review reminder: off, or day and time', () => {
    expect(weeklyReminderLabel(null)).toBe('Off');
    expect(weeklyReminderLabel(REMINDERS_ON.weekly)).toBe('Sunday 10:00 AM');
  });

  test('accounts: synced, by hand, owed', () => {
    const rows = seed.accounts.map(accountRow);
    expect(rows.find((r) => r.id === 'loan')).toMatchObject({
      value: '$8,000 owed',
      subtitle: 'Entered by hand',
      editable: true,
    });
    expect(rows.find((r) => r.id === 'chk')).toMatchObject({ editable: false, value: '$2,000' });
    expect(
      accountRow({
        id: 'x',
        name: 'Savings',
        type: 'savings',
        balance: 0,
        source: 'manual',
        status: 'ok',
      }),
    ).toMatchObject({ subtitle: 'Tap to add balance', value: undefined });
  });
});

describe('modules disappear when off', () => {
  const noTax = {
    ...seed,
    settings: { ...seed.settings, modules: { ...seed.settings.modules, tax: false } },
  };

  test('Tax off: no Tax row on Today, no Tax filter, no Taxes group on a transaction', () => {
    expect(buildTodayView(noTax, now).rows.map((r) => r.id)).not.toContain('tax');
    expect(buildTransactionsView(noTax, 'all').filters.map((f) => f.value)).toEqual([
      'all',
      'untagged',
    ]);
    expect(buildTransactionDetail(noTax, 't1')?.showTaxes).toBe(false);
    expect(buildSettingsView(noTax, DEFAULT_PREFS).showTax).toBe(false);
  });
});

describe('Today (M5 states)', () => {
  test('01c compact sentence is one line', () => {
    const v = buildTodayView(seed, now);
    expect(v.compactSentence).toBe('until Oct 13 · about $50 a day');
    expect(compactSentence({ kind: 'paycheck', date: '2026-10-05' }, 9100, 12)).toBe(
      'until payday Oct 5 · about $91 a day',
    );
  });

  test('no monthly spending yet: Runway asks for it instead of showing 0 months', () => {
    const data = newAppData({
      today: '2026-09-25',
      incomeType: 'freelance',
      accounts: seed.accounts,
    });
    const runway = buildTodayView(data, now).rows[0];
    expect(runway).toMatchObject({ value: 'Not set yet', route: '/settings/number/spend' });
  });

  test('no invoice recorded: a row asks for the next one', () => {
    const data = newAppData({
      today: '2026-09-25',
      incomeType: 'freelance',
      accounts: seed.accounts,
      monthlySpend: 300000,
    });
    expect(buildTodayView(data, now).rows.find((r) => r.id === 'income')).toMatchObject({
      route: '/income/new',
    });
  });

  test('no balances yet (no accounts, or skipped ones at $0): an explanation, not a bare $0', () => {
    const none = newAppData({ today: '2026-09-25', incomeType: 'freelance', accounts: [] });
    expect(buildTodayView(none, now).emptyNote).toMatch(/No balances yet/);
    const zeros = newAppData({
      today: '2026-09-25',
      incomeType: 'freelance',
      accounts: [
        { id: 'c', name: 'Checking', type: 'checking', balance: 0, source: 'manual', status: 'ok' },
        { id: 's', name: 'Savings', type: 'savings', balance: 0, source: 'manual', status: 'ok' },
      ],
    });
    expect(buildTodayView(zeros, now).emptyNote).toMatch(/No balances yet/);
    expect(buildTodayView(seed, now).emptyNote).toBeUndefined();
  });

  test('salary without a pay schedule: Today asks for the next payday', () => {
    const data = newAppData({
      today: '2026-09-25',
      incomeType: 'salary',
      accounts: seed.accounts,
      monthlySpend: 250000,
    });
    expect(buildTodayView(data, now).rows.find((r) => r.id === 'income')).toMatchObject({
      title: 'When’s your next payday?',
      route: '/settings/number/pay',
    });
  });
});

describe('S9 transaction detail', () => {
  test('category choices start with the current one; rule line names the merchant', () => {
    const v = buildTransactionDetail(seed, 't2');
    expect(v?.categories[0]).toBe('Groceries');
    expect(v?.ruleLabel).toBe('Always treat Corner Market this way');
    expect(v?.amount).toBe('−$80.00');
  });

  test('a missing transaction has no detail', () => {
    expect(buildTransactionDetail(seed, 'nope')).toBeUndefined();
  });
});
