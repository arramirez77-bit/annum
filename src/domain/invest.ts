/**
 * Invest handoff (S6, Andy 2026-09-28). "I moved it" empties the Invest bucket and logs the
 * move; the savings total is never edited by hand — the bank sync lowers it. The move stays
 * pending until savings are down by about its amount (at least MOVE_SEEN_SHARE of it) from
 * when it was marked, then it counts as moved. Pure.
 */
import { savingsBalance } from './money';
import type { AppData, Cents, ISODate } from './types';

export interface InvestMove {
  id: string;
  amount: Cents;
  markedOn: ISODate;
  /** Where it went ("Fabrikam Invest"), and that account when Annum tracks it. */
  to: string;
  toAccountId?: string;
  /** Where it leaves from ("Woodgrove"). */
  from: string;
  /** The savings balance when it was marked, to see the money leave. */
  savingsAtMark: Cents;
  status: 'pending' | 'moved';
}

/** How much of the amount savings must drop by before the move counts as gone. */
export const MOVE_SEEN_SHARE = 0.95;

type Where = Pick<InvestMove, 'id' | 'to' | 'toAccountId' | 'from'>;

/** "I moved it": Invest goes to $0 and the move is logged as pending. Null when Invest is empty. */
export function markInvestMoved(
  data: AppData,
  where: Where,
): { data: AppData; move: InvestMove } | null {
  const amount = data.buckets.invest;
  if (amount <= 0) return null;
  return {
    data: { ...data, buckets: { ...data.buckets, invest: 0 } },
    move: {
      ...where,
      amount,
      markedOn: data.today,
      savingsAtMark: savingsBalance(data),
      status: 'pending',
    },
  };
}

/** True once the savings balance shows the money gone. */
export const moveLeftSavings = (move: InvestMove, data: AppData): boolean =>
  savingsBalance(data) <= move.savingsAtMark - Math.round(move.amount * MOVE_SEEN_SHARE);

/** Pending moves that the savings balance now shows as gone become moved (same array if none). */
export function settleInvestMoves(
  moves: readonly InvestMove[],
  data: AppData,
): readonly InvestMove[] {
  let changed = false;
  const next = moves.map((m) => {
    if (m.status !== 'pending' || !moveLeftSavings(m, data)) return m;
    changed = true;
    return { ...m, status: 'moved' as const };
  });
  return changed ? next : moves;
}
