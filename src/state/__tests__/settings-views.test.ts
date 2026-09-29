import { demoScenario, demoSeed } from '@/data/demo';
import { DEFAULT_PREFS, REMINDERS_ON } from '@/data/repo';
import { newAppData } from '@/domain';

import { accountRow } from '../account-views';
import { buildTransactionDetail, buildTransactionsView } from '../review-views';
import { loginsLeft } from '../bank-views';
import {
  accountSources,
  buildDeleteView,
  buildSettingsView,
  targetMonths,
  weeklyReminderLabel,
} from '../settings-views';
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
    expect(weeklyReminderLabel(REMINDERS_ON.weekly)).toBe('Sun 10 AM');
    expect(weeklyReminderLabel({ ...REMINDERS_ON.weekly!, minute: 30 })).toBe('Sun 10:30 AM');
  });

  test('S3 accounts: one card per bank, then files, then by hand', () => {
    const now = new Date('2026-09-23T09:00:00');
    const d = {
      ...seed,
      savingsUnsplit: false,
      accounts: [
        ...seed.accounts.map((a) => (a.source === 'plaid' ? { ...a, itemId: 'item-1' } : a)),
        {
          id: 'f1',
          name: 'Checking ···1234',
          type: 'checking' as const,
          balance: 10000,
          source: 'import' as const,
          lastSynced: '2026-09-20T08:00:00',
          status: 'ok' as const,
        },
      ],
    };
    const bank = {
      itemId: 'item-1',
      institution: 'Woodgrove',
      env: 'production' as const,
      status: 'ok' as const,
      cursor: null,
      createdAt: '2026-09-01T08:00:00',
      lastSynced: '2026-09-23T07:02:00',
    };
    const sources = accountSources(d, [bank], now);
    expect(sources.map((s) => [s.kind, s.title, s.subtitle])).toEqual([
      ['bank', 'Woodgrove', 'Connected · synced 7:02 AM'],
      ['files', 'From files', 'Updated when you import a file'],
      ['hand', 'Entered by hand', 'You update these balances'],
    ]);
    expect(sources[0].accounts).toEqual([
      { id: 'chk', title: 'Woodgrove checking', value: '$2,000', opens: 'transactions' },
      {
        id: 'sav',
        title: 'Savings',
        subtitle: 'Split into buckets',
        value: '$19,100',
        opens: 'transactions',
      },
      {
        id: 'card',
        title: 'Contoso Card',
        subtitle: 'Credit card · due Sep 28',
        value: '$500',
        opens: 'transactions',
      },
    ]);
    expect(sources[1].accounts[0]).toMatchObject({
      subtitle: 'Imported Sep 20',
      opens: 'transactions',
    });
    expect(sources[2].accounts.map((a) => a.opens)).toEqual(['balance', 'balance']);
    // A bank asking to sign in again offers Reconnect.
    const broken = accountSources(d, [{ ...bank, status: 'needs-reauth' as const }], now)[0];
    expect(broken).toMatchObject({ subtitle: 'Needs you to sign in again', reconnect: 'item-1' });
  });

  test('bank logins left: long in Settings, short on the sheet, test banks in development', () => {
    const count = { used: 2, limit: 10, left: 8, sandbox: true, production: false };
    expect(loginsLeft(count, false, true)).toBe(
      '8 of 10 bank logins left. Refreshing a bank you already connected doesn’t use one.',
    );
    expect(loginsLeft(count, true)).toBe('8 of 10 bank logins left. Test banks don’t count.');
    expect(loginsLeft(null, false)).toBeUndefined();
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
    expect(v?.amount).toBe('$80.00');
  });

  test('the rule switch follows the saved rules; the note mentions the tax list', () => {
    expect(buildTransactionDetail(seed, 't2')?.ruleOn).toBe(false);
    const rule = { merchant: 'corner market', category: 'Dining' as const, tax: false };
    expect(buildTransactionDetail(seed, 't2', [rule])?.ruleOn).toBe(true);
    expect(buildTransactionDetail(seed, 't2')?.note).toBe('Changes save as you go.');
    const tagged = seed.transactions.find((t) => t.tax);
    if (tagged) {
      expect(buildTransactionDetail(seed, tagged.id)?.note).toBe(
        'In your 2026 tax list. Changes save as you go.',
      );
    }
  });

  test('a missing transaction has no detail', () => {
    expect(buildTransactionDetail(seed, 'nope')).toBeUndefined();
  });
});

describe('S8 Delete everything', () => {
  test('what goes, with counts; the bank line follows the switch', () => {
    const v = buildDeleteView(seed, 1, false);
    expect(v.rows.map((r) => [r.title, r.value, r.subtitle])).toEqual([
      ['Accounts and balances', '5', 'Bank logins stay open at Plaid'],
      [
        'Transactions and tags',
        String(seed.transactions.length),
        `Including ${seed.transactions.filter((t) => t.tax).length} work expense`,
      ],
      ['Buckets and settings', 'All', 'Tax percentage, Runway target, and your habits'],
    ]);
    expect(v.bankLine).toBe(
      'Your bank logins stay open at Plaid, so a backup can bring them back without using any of your 10.',
    );
    expect(buildDeleteView(seed, 1, true).bankLine).toMatch(/^Ended logins still count/);
    expect(buildDeleteView(seed, 0, false).rows[0].subtitle).toBeUndefined();
  });
});
