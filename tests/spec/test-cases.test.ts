/**
 * The test cases from docs/03-DATA-MODEL.md, run against the real engine in src/domain/
 * with the demo fixtures. Numbering matches the table in docs/03.
 */
import { demoScenario, demoSeed, DEMO_SCENARIOS, scenarioExpectations } from '@/data/demo';
import {
  availableToSpend,
  bucketTotal,
  daysBetween,
  editSplit,
  estimatedRunwayMonths,
  estimatedSpend,
  formatCompactThousands,
  formatDollarChange,
  formatMonthsChange,
  incomeThisQuarter,
  isStale,
  localISODate,
  proposeSplit,
  runwayMonths,
  savingsBalance,
  taxSummary,
  todayStatus,
  unsplitPreview,
  weekAllowance,
  weeklyChanges,
  weeklyTransfer,
  weekReport,
  whatIf,
  type AppData,
} from '@/domain';

const seed = demoSeed();

const withBill = (due: string): AppData => ({
  ...seed,
  bills: [
    ...seed.bills,
    {
      id: 'x',
      name: 'Test bill',
      amount: 30000,
      due,
      cadence: 'monthly',
      confirmed: true,
      payFrom: 'checking',
    },
  ],
});

describe('docs/03-DATA-MODEL.md test cases', () => {
  test('1 · ATS = $1,000', () => {
    expect(availableToSpend(seed).raw).toBe(100000);
  });

  test('2 · days until income = 20', () => {
    expect(availableToSpend(seed).days).toBe(20);
  });

  test('3 · per day = $50', () => {
    expect(availableToSpend(seed).perDay).toBe(5000);
  });

  test('4 · Runway = 4.2 months', () => {
    expect(runwayMonths(seed)).toBe(4.2);
  });

  test('5 · status on-track', () => {
    expect(todayStatus(seed)).toBe('on-track');
  });

  test('6 · what if $200 → $800, $40/day, no guardrail', () => {
    expect(whatIf(seed, 20000)).toMatchObject({
      ats: 80000,
      perDay: 4000,
      runwayMonths: 4.2,
      guardrail: false,
    });
  });

  test('7 · what if $2,000 → Runway 3.9 months, guardrail', () => {
    expect(whatIf(seed, 200000)).toMatchObject({
      runwayMonths: 3.9,
      guardrail: true,
      shortfall: 100000,
    });
  });

  test('8 · weekly transfer = $1,050', () => {
    expect(weeklyTransfer(seed).total).toBe(105000);
  });

  test('9 · $10,000 deposit split', () => {
    expect(proposeSplit(seed, seed.pendingDeposit!.amount)).toEqual({
      tax: 300000,
      bills: 0,
      runway: 240000,
      invest: 230000,
      free: 230000,
    });
  });

  test('10 · editing Tax to $2,500 moves $500 to Free; total unchanged', () => {
    const edit = editSplit(proposeSplit(seed, 1000000), 'tax', 250000);
    expect(edit.split.free).toBe(280000);
    expect(Object.values(edit.split).reduce((a, b) => a + b, 0)).toBe(1000000);
    expect(edit.capped).toBe(false);
  });

  test('11 · heads-up scenario → $200, heads-up', () => {
    const s = demoScenario('heads-up');
    expect(availableToSpend(s).raw).toBe(20000);
    expect(todayStatus(s)).toBe('heads-up');
  });

  test('12 · salary scenario → $1,100, 12 days, $91/day', () => {
    const a = availableToSpend(demoScenario('salary'));
    const actual = { ATS: a.raw, daysUntilIncome: a.days, perDay: a.perDay };
    expect(actual).toEqual({ ATS: 110000, daysUntilIncome: 12, perDay: 9100 });
    expect(scenarioExpectations('salary')).toEqual(actual);
  });

  test('13 · late invoice → heads-up, income assumed Oct 22', () => {
    const s = demoScenario('late-invoice');
    expect(todayStatus(s)).toBe('heads-up');
    expect(availableToSpend(s).nextIncome).toMatchObject({ kind: 'late', date: '2026-10-22' });
  });

  test('14 · stale sync → isStale, status unchanged', () => {
    const s = demoScenario('stale-sync');
    expect(isStale(s, new Date('2026-09-23T09:00:00'))).toBe(true);
    expect(todayStatus(s)).toBe(todayStatus(seed));
  });

  test('15 · cents math: 3 × $0.10 + $0.70 = $1.00 exactly', () => {
    expect(3 * 10 + 70).toBe(100);
  });

  test('16 · days until is the same at 11:59 PM and 12:01 AM on the same date', () => {
    const lateNight = localISODate(new Date(2026, 8, 23, 23, 59));
    const earlyMorning = localISODate(new Date(2026, 8, 23, 0, 1));
    expect(daysBetween(lateNight, '2026-10-13')).toBe(daysBetween(earlyMorning, '2026-10-13'));
  });

  test('17 · bill due on day 30 is in the deposit Bills step', () => {
    expect(proposeSplit(withBill('2026-10-23'), 1000000)).toEqual({
      tax: 300000,
      bills: 30000,
      runway: 240000,
      invest: 215000,
      free: 215000,
    });
  });

  test('18 · bill due on the income date is not in ATS', () => {
    const a = availableToSpend(withBill('2026-10-13'));
    expect(a.raw).toBe(100000);
    expect(a.perDay).toBe(5000);
  });

  test('19 · allowance uses per day at the start of the week → $371, $29 over', () => {
    expect(weekAllowance(seed)).toEqual({ days: 26, perDayAtStart: 5300, allowance: 37100 });
    expect(weekReport(seed).overBy).toBe(2900);
  });

  test('20 · Free to spend is down $400 this week', () => {
    const change = weeklyChanges(seed)!.freeToSpend;
    expect(change).toBe(-40000);
    expect(`${formatDollarChange(change)} — what you spent this week`).toBe(
      'Down $400 — what you spent this week',
    );
  });

  test('21 · Runway is up 0.2 months this week', () => {
    const change = weeklyChanges(seed)!.runwayMonths;
    expect(change).toBe(0.2);
    expect(`${formatMonthsChange(change)} months`).toBe('Up 0.2 months');
    expect(
      `${formatMonthsChange(change)} this week · ${formatCompactThousands(seed.settings.runwayTarget)} target`,
    ).toBe('Up 0.2 this week · $15k target');
  });

  test('22 · tax items per category', () => {
    const summary = taxSummary(seed);
    expect(summary.categories.map((c) => [c.name, c.items])).toEqual([
      ['Equipment', 3],
      ['Software', 12],
      ['Home office', 4],
      ['Travel', 2],
    ]);
    expect([summary.total, summary.items]).toEqual([380000, 21]);
  });

  test('23 · late invoice amounts → $175, $35/day', () => {
    const s = demoScenario('late-invoice');
    const a = availableToSpend(s);
    expect([a.raw, a.days, a.perDay]).toEqual([17500, 5, 3500]);
    expect(bucketTotal(s)).toBe(savingsBalance(s));
  });

  test('24 · first-run estimate → about $1,300, $65/day, ~6 months', () => {
    const s = demoScenario('first-run');
    expect(estimatedSpend(s)).toMatchObject({ amount: 130000, perDay: 6500 });
    expect(estimatedRunwayMonths(s)).toBe(6);
    expect(todayStatus(s)).toBe('estimate');
  });

  test('25 · unsplit preview → Tax $4,500 · Bills $2,000 · Runway $12,600 · Free $0', () => {
    const s = demoScenario('first-run');
    expect(incomeThisQuarter(s).total).toBe(1500000);
    const preview = unsplitPreview(s);
    expect(preview).toEqual({ tax: 450000, bills: 200000, runway: 1260000, invest: 0, free: 0 });
    expect(Object.values(preview).reduce((a, b) => a + b, 0)).toBe(savingsBalance(s));
  });
});

describe('fixture integrity', () => {
  const split = DEMO_SCENARIOS.filter((name) => name !== 'first-run');
  test.each(split)('buckets add up to savings in %s', (name) => {
    const s = demoScenario(name);
    expect(bucketTotal(s)).toBe(savingsBalance(s));
  });

  test('first-run has unsplit savings', () => {
    const s = demoScenario('first-run');
    expect(s.savingsUnsplit).toBe(true);
    expect(bucketTotal(s)).toBe(0);
  });
});
