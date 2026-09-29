import { demoSeed } from '@/data/demo';
import {
  markInvestMoved,
  moveLeftSavings,
  savingsBalance,
  settleInvestMoves,
  type AppData,
} from '@/domain';

const withInvest = (invest: number): AppData => {
  const d = demoSeed();
  return { ...d, buckets: { ...d.buckets, invest } };
};
const where = { id: 'm1', to: 'Fabrikam Invest', toAccountId: 'brokerage', from: 'Woodgrove' };
const lowerSavings = (d: AppData, by: number): AppData => ({
  ...d,
  accounts: d.accounts.map((a) => (a.type === 'savings' ? { ...a, balance: a.balance - by } : a)),
});

describe('S6 invest handoff (Andy, 2026-09-28)', () => {
  test('"I moved it" empties Invest and logs a pending move; the savings total is untouched', () => {
    const d = withInvest(230000);
    const r = markInvestMoved(d, where)!;
    expect(r.data.buckets.invest).toBe(0);
    expect(savingsBalance(r.data)).toBe(savingsBalance(d));
    expect(r.data.buckets.free).toBe(d.buckets.free);
    expect(r.move).toEqual({
      ...where,
      amount: 230000,
      markedOn: d.today,
      savingsAtMark: savingsBalance(d),
      status: 'pending',
    });
  });

  test('nothing to move when Invest is empty', () => {
    expect(markInvestMoved(withInvest(0), where)).toBeNull();
  });

  test('pending until savings drop by about the amount (95% or more), then moved', () => {
    const d = withInvest(230000);
    const { data, move } = markInvestMoved(d, where)!;
    expect(moveLeftSavings(move, data)).toBe(false);
    expect(settleInvestMoves([move], lowerSavings(data, 200000))[0].status).toBe('pending');
    expect(settleInvestMoves([move], lowerSavings(data, 218500))[0].status).toBe('moved');
    expect(settleInvestMoves([move], lowerSavings(data, 230000))[0].status).toBe('moved');
  });

  test('settling leaves the same array when nothing changed', () => {
    const { data, move } = markInvestMoved(withInvest(1000), where)!;
    const moves = [move];
    expect(settleInvestMoves(moves, data)).toBe(moves);
  });
});
