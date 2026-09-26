import { demoScenario, demoSeed } from '@/data/demo';
import {
  editSplit,
  fourWeekAverage,
  notableCategory,
  proposeSplit,
  splitTotal,
  summarizeSpending,
  unsplitPreview,
  usualLabel,
  weeklyChanges,
  weekReport,
  type AppData,
  type Transaction,
} from '@/domain';

const seed = demoSeed();
const tx = (id: string, date: string, amount: number, category?: string): Transaction => ({
  id,
  accountId: 'chk',
  date,
  merchant: `M${id}`,
  amount,
  category,
  tax: false,
  reviewed: true,
});

describe('deposit waterfall', () => {
  test('salary: no Tax step', () => {
    const split = proposeSplit(demoScenario('salary'), 250000);
    expect(split.tax).toBe(0);
    expect(splitTotal(split)).toBe(250000);
  });

  test('Runway not full after the deposit: nothing goes to Invest', () => {
    const split = proposeSplit(seed, 300000);
    expect(split).toEqual({ tax: 90000, bills: 0, runway: 210000, invest: 0, free: 0 });
  });

  test('Invest module off: Invest stays 0 even with Runway full', () => {
    const data: AppData = {
      ...seed,
      settings: { ...seed.settings, modules: { ...seed.settings.modules, invest: false } },
    };
    expect(proposeSplit(data, 1000000)).toMatchObject({ invest: 0, free: 460000 });
  });

  test('an edit that would push Free below 0 is capped at what fits', () => {
    const split = proposeSplit(seed, 1000000);
    const edit = editSplit(split, 'runway', 900000);
    expect(edit.capped).toBe(true);
    expect(edit.split.runway).toBe(1000000 - 300000 - 0 - 230000);
    expect(edit.split.free).toBe(0);
    expect(splitTotal(edit.split)).toBe(1000000);
  });

  test('edits are integer cents and never negative', () => {
    const edit = editSplit(proposeSplit(seed, 1000000), 'tax', -500.4);
    expect(edit.split.tax).toBe(0);
    expect(splitTotal(edit.split)).toBe(1000000);
  });

  test('unsplit preview never exceeds savings', () => {
    const small: AppData = {
      ...demoScenario('first-run'),
      accounts: demoScenario('first-run').accounts.map((a) =>
        a.type === 'savings' ? { ...a, balance: 300000 } : a,
      ),
    };
    const preview = unsplitPreview(small);
    expect(preview).toEqual({ tax: 300000, bills: 0, runway: 0, invest: 0, free: 0 });
  });
});

describe('weekly report', () => {
  test('empty week: nothing spent, no categories', () => {
    const data: AppData = { ...seed, thisWeek: undefined, transactions: [] };
    const report = weekReport(data);
    expect(report.spent).toBe(0);
    expect(report.topCategories).toEqual([]);
    expect(report.overBy).toBe(-37100);
    expect(notableCategory(report)).toBeUndefined();
  });

  test('top 3 with labels; Dining is the notable change', () => {
    const report = weekReport(seed);
    expect(report.topCategories.map((c) => [c.category, c.label])).toEqual([
      ['Dining', 'more than usual'],
      ['Groceries', 'about usual'],
      ['Gas', 'less than usual'],
    ]);
    expect(notableCategory(report)?.category).toBe('Dining');
  });

  test('usual labels at the ±20% boundaries', () => {
    expect(usualLabel(12000, 10000)).toBe('about usual');
    expect(usualLabel(12001, 10000)).toBe('more than usual');
    expect(usualLabel(8000, 10000)).toBe('about usual');
    expect(usualLabel(7999, 10000)).toBe('less than usual');
    expect(usualLabel(500, 0)).toBe('more than usual');
  });

  test('spending from transactions skips income, transfers, card payments and pending', () => {
    const txs = [
      tx('1', '2026-09-18', -1000, 'Dining'),
      tx('2', '2026-09-19', -2000, 'Transfer'),
      tx('3', '2026-09-20', -3000, 'Card payment'),
      tx('4', '2026-09-21', 500000, 'Income'),
      { ...tx('5', '2026-09-22', -4000, 'Dining'), pending: true },
      tx('6', '2026-09-10', -9999, 'Dining'),
    ];
    expect(summarizeSpending(txs, '2026-09-17', '2026-09-23')).toEqual({
      spent: 1000,
      byCategory: { Dining: 1000 },
    });
    expect(summarizeSpending([], '2026-09-17', '2026-09-23')).toEqual({ spent: 0, byCategory: {} });
  });

  test('4-week average divides the prior 28 days by 4', () => {
    const txs = [
      tx('1', '2026-08-20', -4000, 'Gas'),
      tx('2', '2026-09-16', -4000, 'Gas'),
      tx('3', '2026-09-17', -9000, 'Gas'),
    ];
    expect(fourWeekAverage(txs, '2026-09-17')).toEqual({ Gas: 2000 });
  });

  test('no weekStart snapshot: no weekly changes', () => {
    expect(weeklyChanges({ ...seed, weekStart: undefined })).toBeUndefined();
  });
});
