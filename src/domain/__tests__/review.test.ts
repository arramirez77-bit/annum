import { demoScenario, demoSeed } from '@/data/demo';
import {
  applyTaxChanges,
  bucketsMatchSavings,
  confirmSplit,
  nextReviewDate,
  proposeSplit,
  savingsBalance,
  spendBar,
  taxCsv,
  taxSummary,
  toTag,
  unsplitPreview,
} from '@/domain';

const seed = demoSeed();

describe('weekly review helpers', () => {
  test('next review is the coming Sunday', () => {
    expect(nextReviewDate('2026-09-23')).toBe('2026-09-27'); // Wednesday → Sunday
    expect(nextReviewDate('2026-09-27')).toBe('2026-10-04'); // Sunday → next Sunday
    expect(nextReviewDate('2026-09-26')).toBe('2026-09-27');
  });

  test('tag step shows this week’s unreviewed transactions', () => {
    expect(toTag(seed).map((t) => t.merchant)).toEqual(['Litware', 'Corner Market', 'Fuel Stop']);
  });

  test('tagging Corner Market as a work expense adds it to Taxes; untagging Litware takes it off', () => {
    const after = seed.transactions.map((t) =>
      t.id === 't2'
        ? { ...t, tax: true, taxCategory: 'Home office' }
        : t.id === 't1'
          ? { ...t, tax: false }
          : t,
    );
    const taxYear = applyTaxChanges(seed.taxYear!, seed.transactions, after);
    expect(taxYear.byCategory['Home office']).toBe(50000 + 8000);
    expect(taxYear.itemsByCategory['Home office']).toBe(5);
    expect(taxYear.byCategory.Software).toBe(100000 - 2000);
    expect(taxYear.itemsByCategory.Software).toBe(11);
    expect(taxSummary({ ...seed, taxYear }).total).toBe(380000 + 8000 - 2000);
  });

  test('no tag changes: totals unchanged', () => {
    expect(applyTaxChanges(seed.taxYear!, seed.transactions, seed.transactions)).toEqual(
      seed.taxYear,
    );
  });

  test('confirming a landed deposit grows savings and buckets together', () => {
    const split = proposeSplit(seed, 1000000);
    const after = confirmSplit(seed, split, true);
    expect(after.accounts.find((a) => a.type === 'savings')!.balance).toBe(1910000 + 1000000);
    expect(after.buckets).toEqual({
      tax: 600000,
      bills: 200000,
      runway: 1500000,
      invest: 230000,
      free: 380000,
    });
    expect(after.pendingDeposit).toMatchObject({ confirmed: true, split });
    expect(bucketsMatchSavings(after)).toBe(true);
  });

  test('the first split of unsplit savings only labels the money', () => {
    const data = demoScenario('first-run');
    const after = confirmSplit(data, unsplitPreview(data), false);
    expect(after.accounts.find((a) => a.type === 'savings')!.balance).toBe(1910000);
    expect(after.savingsUnsplit).toBe(false);
    expect(bucketsMatchSavings(after)).toBe(true);
  });

  test('spend bar: within the allowance plus any overflow', () => {
    expect(spendBar(40000, 37100)).toEqual({ within: 37100, over: 2900, left: 0 });
    expect(spendBar(20000, 37100)).toEqual({ within: 20000, over: 0, left: 17100 });
  });

  test('accountant CSV: tagged transactions for the year, quoted safely', () => {
    const data = {
      ...seed,
      transactions: [
        ...seed.transactions,
        {
          ...seed.transactions[1],
          id: 'q',
          merchant: 'Pens, "Fine"',
          tax: true,
          taxCategory: 'Office',
        },
      ],
    };
    expect(taxCsv(data, 2026)).toBe(
      'Date,Merchant,Tax category,Amount (USD),Account\n' +
        '2026-09-21,Litware,Software,20.00,Contoso Card\n' +
        '2026-09-22,"Pens, ""Fine""",Office,80.00,Woodgrove checking\n',
    );
  });
});

describe('an imported deposit is already in the savings balance', () => {
  test('confirming its split labels the money without adding it to savings again', () => {
    const data = { ...seed, pendingDeposit: { ...seed.pendingDeposit!, inBalance: true } };
    const split = proposeSplit(data, data.pendingDeposit.amount);
    const after = confirmSplit(data, split, true);
    expect(savingsBalance(after)).toBe(savingsBalance(data));
    expect(after.pendingDeposit?.confirmed).toBe(true);
  });
});
