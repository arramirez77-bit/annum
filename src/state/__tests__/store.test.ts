import { bucketsMatchSavings, proposeSplit, savingsBalance, taxSummary } from '@/domain';

import { useAppStore } from '../store';

const s = () => useAppStore.getState();

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

beforeEach(() => s().setScenario('on-track'));

describe('tagging', () => {
  test('the Tax chip moves the transaction into the Taxes total right away', () => {
    expect(taxSummary(s().data).total).toBe(380000);
    s().toggleTax('t2'); // Corner Market, $80
    expect(taxSummary(s().data).total).toBe(388000);
    s().toggleTax('t2');
    expect(taxSummary(s().data).total).toBe(380000);
  });

  test('accepting suggestions marks them reviewed and writes no rules', () => {
    s().finishTagging();
    expect(s().data.transactions.filter((t) => !t.reviewed)).toEqual([]);
    expect(s().rules).toEqual([]);
  });

  test('a correction becomes a merchant rule', () => {
    s().chooseCategory('t2', 'Other');
    s().toggleTax('t3');
    s().finishTagging();
    expect(s().rules).toEqual([
      { merchant: 'corner market', category: 'Other', tax: false, taxCategory: undefined },
      { merchant: 'fuel stop', category: 'Gas', tax: true, taxCategory: 'Gas' },
    ]);
    expect(s().data.transactions.find((t) => t.id === 't2')).toMatchObject({
      category: 'Other',
      reviewed: true,
    });
  });
});

describe('review and deposit', () => {
  test('marking the transfer moved, then finishing the review', () => {
    useAppStore.setState({
      data: { ...s().data, settings: { ...s().data.settings, isEstimate: true } },
    });
    s().markTransferMoved(105000);
    expect(s().pendingTransfer).toEqual({ amount: 105000, markedOn: '2026-09-23' });
    s().saveReviewStep(4);
    s().completeReview();
    expect(s().data.settings.isEstimate).toBe(false);
    expect(s().lastReviewDate).toBe('2026-09-23');
    expect(s().reviewStep).toBe(1);
  });

  test('confirming the split keeps buckets equal to savings', () => {
    const split = proposeSplit(s().data, 1000000);
    s().confirmDeposit(split, true);
    expect(savingsBalance(s().data)).toBe(2910000);
    expect(bucketsMatchSavings(s().data)).toBe(true);
    expect(s().data.pendingDeposit?.confirmed).toBe(true);
  });

  test('setting the habit and the first-split settings', () => {
    s().setHabit(110000, 'biweekly');
    s().setSplitSettings(0.25, 900000);
    expect(s().data.settings).toMatchObject({
      habitTransfer: { amount: 110000, cadence: 'biweekly' },
      taxRate: 0.25,
      runwayTarget: 900000,
    });
  });
});
