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

describe('S6 invest handoff and S7 waited-on purchase (Phase 3)', () => {
  const savings = () => s().data.accounts.find((a) => a.type === 'savings')!;

  test('"I moved it": Invest to $0, logged as pending, moved once savings show it gone', () => {
    s().confirmDeposit(proposeSplit(s().data, 1000000), true);
    const invest = s().data.buckets.invest;
    expect(invest).toBe(230000);
    const before = savingsBalance(s().data);
    const move = s().markInvestMoved({
      to: 'Fabrikam Invest',
      toAccountId: 'brokerage',
      from: 'Woodgrove',
    });
    expect(move).toMatchObject({ amount: 230000, status: 'pending', savingsAtMark: before });
    expect(s().data.buckets.invest).toBe(0);
    expect(savingsBalance(s().data)).toBe(before);
    expect(s().investMoves).toHaveLength(1);
    // The bank sync shows savings down by the amount: the move is done.
    s().setBalance(savings().id, savings().balance - 230000);
    expect(s().investMoves[0].status).toBe('moved');
    expect(s().markInvestMoved({ to: 'x', from: 'y' })).toBeNull();
  });

  test('one tap adds the moved amount to an account entered by hand, never to a bank account', () => {
    const fabrikam = s().data.accounts.find((a) => a.id === 'brokerage')!;
    s().addToBalance('brokerage', 230000);
    expect(s().data.accounts.find((a) => a.id === 'brokerage')).toMatchObject({
      balance: fabrikam.balance + 230000,
      enteredOn: '2026-09-23',
    });
    const checking = s().data.accounts.find((a) => a.id === 'chk')!;
    s().addToBalance('chk', 230000);
    expect(s().data.accounts.find((a) => a.id === 'chk')!.balance).toBe(checking.balance);
  });

  test('waited-on purchases keep the day they were put off; wait again, buy, or drop', () => {
    const p = s().deferPurchase(200000, '2026-10-13');
    expect(p.createdOn).toBe('2026-09-23');
    s().waitAgain(p.id, '2026-11-13');
    expect(s().deferred[0].waitUntil).toBe('2026-11-13');
    s().resolveDeferred(p.id, 'bought');
    expect(s().deferred[0].status).toBe('bought');
  });
});

describe('M5: history, accounts, modules', () => {
  test('finishing a review records it and starts a new week from today', () => {
    s().markTransferMoved(105000);
    s().completeReview();
    expect(s().reviews).toEqual([
      { id: 'review-2026-09-23', date: '2026-09-23', transfer: 105000 },
    ]);
    expect(s().data.weekStart).toMatchObject({ date: '2026-09-23', runway: 1260000 });
  });

  test('a confirmed split is kept as history with its deposit', () => {
    s().confirmDeposit(proposeSplit(s().data, 1000000), true);
    expect(s().splits).toHaveLength(1);
    expect(s().splits[0]).toMatchObject({
      depositId: s().data.pendingDeposit?.id,
      date: '2026-09-23',
    });
    expect(s().deposits.find((d) => d.id === s().data.pendingDeposit?.id)?.confirmed).toBe(true);
  });

  test('accounts by hand: add, update, stop tracking (its transactions go too)', () => {
    s().saveAccount({
      id: 'a1',
      name: 'Fabrikam 401k',
      type: 'brokerage',
      balance: 500000,
      source: 'manual',
      status: 'ok',
    });
    expect(s().data.accounts.find((a) => a.id === 'a1')?.balance).toBe(500000);
    s().saveAccount({ ...s().data.accounts.find((a) => a.id === 'a1')!, balance: 600000 });
    expect(s().data.accounts.filter((a) => a.id === 'a1')).toHaveLength(1);
    s().stopTracking('chk');
    expect(s().data.accounts.some((a) => a.id === 'chk')).toBe(false);
    expect(s().data.transactions.some((t) => t.accountId === 'chk')).toBe(false);
  });

  test('S9: editing a transaction and "always treat" writes a merchant rule', () => {
    s().editTransaction('t2', { category: 'Dining', tax: true, taxCategory: 'Meals' });
    expect(s().data.transactions.find((t) => t.id === 't2')).toMatchObject({
      category: 'Dining',
      tax: true,
    });
    expect(s().alwaysTreat('t2')).toEqual({
      merchant: 'corner market',
      category: 'Dining',
      tax: true,
      taxCategory: 'Meals',
    });
    expect(s().rules).toHaveLength(1);
    s().forgetRule('t2');
    expect(s().rules).toHaveLength(0);
  });

  test('paycheck from Settings: set, then remove', () => {
    s().setPaySchedule({ amount: 250000, cadence: 'biweekly', next: '2026-10-05' });
    expect(s().data.settings.paySchedule).toEqual({
      amount: 250000,
      cadence: 'biweekly',
      next: '2026-10-05',
    });
    s().setPaySchedule(undefined);
    expect(s().data.settings).not.toHaveProperty('paySchedule');
  });

  test('modules and numbers from Settings', () => {
    s().setModules({ tax: false });
    expect(s().data.settings.modules).toEqual({ tax: false, debt: false, invest: true });
    s().setNumbers({ monthlySpend: 400000, runwayTarget: 2000000 });
    expect(s().data.settings).toMatchObject({ monthlySpend: 400000, runwayTarget: 2000000 });
  });

  test('real mode recomputes the Taxes totals from transactions', () => {
    const data = s().data;
    s().hydrate(
      {
        data,
        prefs: s().prefs,
        deposits: [],
        splits: [],
        reviews: [],
        rules: [],
        deferred: [],
        connections: [],
        reviewStep: 1,
        pendingTransfer: null,
        investMoves: [],
        startedOn: '2026-09-01',
      },
      false,
    );
    expect(s()).toMatchObject({ mode: 'real', phase: 'ready', loaded: true });
    s().toggleTax('t2');
    expect(s().data.taxYear?.byCategory).toEqual({ Software: 2000, Groceries: 8000 });
  });

  test('the date only moves in real mode; reset returns to first run', () => {
    s().setToday('2026-09-30');
    expect(s().data.today).toBe('2026-09-23'); // demo keeps the fixture's day
    s().reset();
    expect(s()).toMatchObject({ phase: 'onboarding', mode: 'real', loaded: false });
    expect(s().data.accounts).toEqual([]);
  });
});
