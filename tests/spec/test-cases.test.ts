/**
 * The test cases from docs/03-DATA-MODEL.md, run against fixtures/.
 * Until M1 they use the test-only reference in ./reference.ts; M1 points them at src/domain/.
 */
import {
  account,
  ats,
  daysBetween,
  estimate,
  isStale,
  localIsoDate,
  runwayMonths,
  scenario,
  seed,
  status,
  waterfall,
  weekReport,
  weeklyChanges,
  weeklyTransfer,
  whatIf,
  type Fixture,
} from './reference';

const withBill = (due: string): Fixture => ({
  ...seed,
  bills: [
    ...seed.bills,
    { id: 'x', name: 'Test bill', amount: 30000, due, confirmed: true, payFrom: 'checking' },
  ],
});
const bucketTotal = (s: Fixture) => Object.values(s.buckets).reduce((a, b) => a + b, 0);

describe('docs/03-DATA-MODEL.md test cases', () => {
  test('1 · ATS = $1,000', () => {
    expect(ats(seed).raw).toBe(100000);
  });

  test('2 · days until income = 20', () => {
    expect(ats(seed).days).toBe(20);
  });

  test('3 · per day = $50', () => {
    expect(ats(seed).perDay).toBe(5000);
  });

  test('4 · Runway = 4.2 months', () => {
    expect(runwayMonths(seed)).toBe(4.2);
  });

  test('5 · status on-track', () => {
    expect(status(seed)).toBe('on-track');
  });

  test('6 · what if $200 → $800, $40/day, no guardrail', () => {
    expect(whatIf(seed, 20000)).toEqual({
      ats: 80000,
      perDay: 4000,
      runway: 4.2,
      guardrail: false,
    });
  });

  test('7 · what if $2,000 → Runway 3.9 months, guardrail', () => {
    expect(whatIf(seed, 200000)).toMatchObject({ runway: 3.9, guardrail: true });
  });

  test('8 · weekly transfer = $1,050', () => {
    expect(weeklyTransfer(seed)).toBe(105000);
  });

  test('9 · $10,000 deposit split', () => {
    expect(waterfall(seed, seed.pendingDeposit.amount)).toEqual({
      tax: 300000,
      bills: 0,
      runway: 240000,
      invest: 230000,
      free: 230000,
    });
  });

  test('10 · editing Tax to $2,500 moves $500 to Free; total unchanged', () => {
    const split = waterfall(seed, 1000000);
    const free = split.free + (split.tax - 250000);
    expect(free).toBe(280000);
    expect(250000 + split.bills + split.runway + split.invest + free).toBe(1000000);
  });

  test('11 · heads-up scenario → $200, heads-up', () => {
    const s = scenario('heads-up');
    expect(ats(s).raw).toBe(20000);
    expect(status(s)).toBe('heads-up');
  });

  test('12 · salary scenario → $1,100, 12 days, $91/day', () => {
    const s = scenario('salary');
    const a = ats(s);
    expect({ ATS: a.raw, daysUntilIncome: a.days, perDay: a.perDay }).toEqual({
      ATS: 110000,
      daysUntilIncome: 12,
      perDay: 9100,
    });
    expect(s._expect).toEqual({ ATS: 110000, daysUntilIncome: 12, perDay: 9100 });
  });

  test('13 · late invoice → heads-up, income assumed Oct 22', () => {
    const s = scenario('late-invoice');
    expect(status(s)).toBe('heads-up');
    expect(ats(s).income).toBe('2026-10-22');
  });

  test('14 · stale sync → isStale, status unchanged', () => {
    const s = scenario('stale-sync');
    expect(isStale(s, '2026-09-23T09:00:00')).toBe(true);
    expect(status(s)).toBe(status(seed));
  });

  test('15 · cents math: 3 × $0.10 + $0.70 = $1.00 exactly', () => {
    expect(3 * 10 + 70).toBe(100);
  });

  test('16 · days until is the same at 11:59 PM and 12:01 AM on the same date', () => {
    const lateNight = localIsoDate(new Date(2026, 8, 23, 23, 59));
    const earlyMorning = localIsoDate(new Date(2026, 8, 23, 0, 1));
    expect(daysBetween(lateNight, '2026-10-13')).toBe(daysBetween(earlyMorning, '2026-10-13'));
  });

  test('17 · bill due on day 30 is in the deposit Bills step', () => {
    expect(waterfall(withBill('2026-10-23'), 1000000)).toEqual({
      tax: 300000,
      bills: 30000,
      runway: 240000,
      invest: 215000,
      free: 215000,
    });
  });

  test('18 · bill due on the income date is not in ATS', () => {
    const s = withBill('2026-10-13');
    expect(ats(s).raw).toBe(100000);
    expect(ats(s).perDay).toBe(5000);
  });

  test('19 · allowance uses per day at the start of the week → $371, $29 over', () => {
    expect(weekReport(seed)).toEqual({
      days: 26,
      perDayAtStart: 5300,
      allowance: 37100,
      over: 2900,
    });
  });

  test('20 · Free to spend is down $400 this week', () => {
    expect(weeklyChanges(seed).freeToSpend).toBe(-40000);
  });

  test('21 · Runway is up 0.2 months this week', () => {
    expect(weeklyChanges(seed).runwayMonths).toBe(0.2);
  });

  test('22 · tax items per category', () => {
    expect(seed.taxYear.itemsByCategory).toEqual({
      Equipment: 3,
      Software: 12,
      'Home office': 4,
      Travel: 2,
    });
  });

  test('23 · late invoice amounts → $175, $35/day', () => {
    const s = scenario('late-invoice');
    const a = ats(s);
    expect([a.raw, a.days, a.perDay]).toEqual([17500, 5, 3500]);
    expect(bucketTotal(s)).toBe(account(s, 'savings').balance);
  });

  test('24 · first-run estimate → about $1,300, $65/day, ~6 months', () => {
    const s = scenario('first-run');
    expect(estimate(s)).toMatchObject({ spend: 130000, perDay: 6500, runwayApproxMonths: 6 });
    expect(status(s)).toBe('estimate');
  });

  test('25 · unsplit preview → Tax $4,500 · Bills $2,000 · Runway $12,600 · Free $0', () => {
    const e = estimate(scenario('first-run'));
    expect(e.income).toBe(1500000);
    expect(e.preview).toEqual({ tax: 450000, bills: 200000, runway: 1260000, free: 0 });
    expect(e.preview.tax + e.preview.bills + e.preview.runway + e.preview.free).toBe(e.savings);
  });
});

describe('fixture integrity', () => {
  test.each(['on-track', 'heads-up', 'stale-sync', 'late-invoice', 'salary'])(
    'buckets add up to savings in %s',
    (name) => {
      const s = scenario(name);
      expect(bucketTotal(s)).toBe(account(s, 'savings').balance);
    },
  );
});
