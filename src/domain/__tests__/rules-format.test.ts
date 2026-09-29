import {
  applyRules,
  detectRecurring,
  findRule,
  formatCents,
  formatCompactThousands,
  formatDollarChange,
  formatDollars,
  formatMonths,
  formatMonthsChange,
  formatShortDate,
  formatSignedCents,
  formatLedgerCents,
  formatDayLabel,
  formatWeekdayDate,
  loadScenario,
  mergeOverride,
  normalizeMerchant,
  ruleFromCorrection,
  toAppData,
  upsertRule,
  type Transaction,
} from '@/domain';

const tx = (
  id: string,
  merchant: string,
  date: string,
  amount: number,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id,
  accountId: 'chk',
  date,
  merchant,
  amount,
  tax: false,
  reviewed: false,
  ...extra,
});

describe('categorization rules', () => {
  test('merchant names normalize', () => {
    expect(normalizeMerchant('CORNER MARKET #0412')).toBe('corner market');
    expect(normalizeMerchant('Corner Market, Inc.')).toBe('corner market');
    expect(normalizeMerchant('Fuel Stop 00231 Denver')).toBe('fuel stop denver');
  });

  test('exact match first, then the longest prefix rule', () => {
    const rules = [
      { merchant: 'fuel stop', category: 'Gas' },
      { merchant: 'fuel stop denver', category: 'Travel' },
    ];
    expect(findRule('Fuel Stop 00231 Denver', rules)?.category).toBe('Travel');
    expect(findRule('FUEL STOP #88 BOULDER', rules)?.category).toBe('Gas');
    expect(findRule('Green Bowl', rules)).toBeUndefined();
  });

  test('rules pre-select suggestions but never touch reviewed transactions', () => {
    const rules = [
      { merchant: 'litware', category: 'Software', tax: true, taxCategory: 'Software' },
    ];
    const [fresh, reviewed] = applyRules(
      [
        tx('1', 'LITWARE*SUB 5501', '2026-09-21', -2000),
        tx('2', 'Litware', '2026-09-20', -2000, { reviewed: true }),
      ],
      rules,
    );
    expect(fresh).toMatchObject({
      suggestedCategory: 'Software',
      tax: true,
      taxCategory: 'Software',
    });
    expect(reviewed.suggestedCategory).toBeUndefined();
  });

  test('a correction writes a rule, and the latest correction wins', () => {
    const t = tx('1', 'Green Bowl #12', '2026-09-21', -1500);
    let rules = upsertRule([], ruleFromCorrection(t, 'Dining', false));
    rules = upsertRule(rules, ruleFromCorrection(t, 'Work meals', true, 'Meals'));
    expect(rules).toEqual([
      { merchant: 'green bowl', category: 'Work meals', tax: true, taxCategory: 'Meals' },
    ]);
  });
});

describe('recurring bill detection', () => {
  test('finds a monthly bill and predicts the next due date', () => {
    const txs = [
      tx('1', 'Phone Co', '2026-06-30', -5000),
      tx('2', 'Phone Co', '2026-07-30', -5000),
      tx('3', 'Phone Co', '2026-08-30', -5200),
      tx('4', 'Corner Market', '2026-08-02', -8000),
      tx('5', 'Corner Market', '2026-08-03', -3000),
      tx('6', 'Corner Market', '2026-08-20', -12000),
    ];
    expect(detectRecurring(txs, '2026-09-23')).toEqual([
      {
        merchant: 'Phone Co',
        amount: 5000,
        cadence: 'monthly',
        lastDate: '2026-08-30',
        nextDue: '2026-09-30',
        occurrences: 3,
      },
    ]);
  });

  test('weekly and biweekly cadences', () => {
    const weekly = ['2026-09-01', '2026-09-08', '2026-09-15'].map((d, i) =>
      tx(`w${i}`, 'Gym', d, -1500),
    );
    const biweekly = ['2026-08-14', '2026-08-28', '2026-09-11'].map((d, i) =>
      tx(`b${i}`, 'Cleaner', d, -6000),
    );
    const found = detectRecurring([...weekly, ...biweekly], '2026-09-16');
    expect(found.map((f) => [f.merchant, f.cadence, f.nextDue])).toEqual([
      ['Gym', 'weekly', '2026-09-22'],
      ['Cleaner', 'biweekly', '2026-09-25'],
    ]);
  });

  test('ignores amounts that vary too much, stopped bills, and too few payments', () => {
    const varying = ['2026-06-01', '2026-07-01', '2026-08-01'].map((d, i) =>
      tx(`v${i}`, 'Utility', d, -(5000 + i * 2000)),
    );
    const stopped = ['2026-03-01', '2026-04-01', '2026-05-01'].map((d, i) =>
      tx(`s${i}`, 'Old Sub', d, -1000),
    );
    const two = ['2026-08-01', '2026-09-01'].map((d, i) => tx(`t${i}`, 'New Sub', d, -1000));
    expect(detectRecurring([...varying, ...stopped, ...two], '2026-09-23')).toEqual([]);
    expect(detectRecurring([], '2026-09-23')).toEqual([]);
  });
});

describe('scenario loader', () => {
  const base = {
    today: '2026-09-23',
    accounts: [
      { id: 'a', balance: 100 },
      { id: 'b', balance: 200 },
    ],
    bills: [],
    expectedIncome: [],
    transactions: [],
    buckets: { tax: 0, bills: 0, runway: 0, invest: 0, free: 0 },
  };

  test('arrays merge by id; array overrides replace', () => {
    expect(mergeOverride(base, { accounts: { b: { balance: 250 } } })).toMatchObject({
      accounts: [
        { id: 'a', balance: 100 },
        { id: 'b', balance: 250 },
      ],
    });
    expect(mergeOverride(base, { accounts: [] })).toMatchObject({ accounts: [] });
  });

  test('metadata keys become settings; unknown scenarios and bad cents are rejected', () => {
    const data = toAppData({ ...base, _note: 'x', _lateAssumeDays: 3, _savingsUnsplit: true });
    expect([data.lateAssumeDays, data.savingsUnsplit, '_note' in data]).toEqual([3, true, false]);
    expect(() => loadScenario(base, { a: {} }, 'nope')).toThrow('Unknown scenario');
    expect(() => toAppData({ ...base, accounts: [{ id: 'a', balance: 1.5 }] })).toThrow(
      'integer cents',
    );
    expect(() => toAppData({ ...base, today: 'Sep 23' })).toThrow('not a date');
  });
});

describe('formatting', () => {
  test('money', () => {
    expect(formatDollars(124099)).toBe('$1,240');
    expect(formatDollars(-40000)).toBe('−$400');
    expect(formatCents(-8412)).toBe('−$84.12');
    expect(formatSignedCents(500000)).toBe('+$5,000.00');
    expect(formatLedgerCents(-2000)).toBe('$20.00');
    expect(formatLedgerCents(500000)).toBe('+$5,000.00');
    expect(formatCompactThousands(1500000)).toBe('$15k');
    expect(formatCompactThousands(1250000)).toBe('$12.5k');
  });

  test('day headers', () => {
    expect(formatDayLabel('2026-09-23', '2026-09-23')).toBe('Today');
    expect(formatDayLabel('2026-09-22', '2026-09-23')).toBe('Yesterday');
    expect(formatDayLabel('2026-09-21', '2026-09-23')).toBe('Monday');
    expect(formatDayLabel('2026-09-16', '2026-09-23')).toBe('Sep 16');
  });

  test('changes and months', () => {
    expect(formatDollarChange(-40000)).toBe('Down $400');
    expect(formatDollarChange(0)).toBe('No change');
    expect(formatMonths(4.2)).toBe('4.2');
    expect(formatMonthsChange(-0.3)).toBe('Down 0.3');
  });

  test('dates never shift with the time zone', () => {
    expect(formatShortDate('2026-10-13')).toBe('Oct 13');
    expect(formatWeekdayDate('2026-09-27')).toBe('Sunday, Sep 27');
  });
});
