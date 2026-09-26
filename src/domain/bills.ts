/**
 * Bills: roll due dates forward as they pass, and propose new ones from repeated payments out of
 * checking (docs/06 M6 "Recurring bills proposed"). Proposals don't count until confirmed.
 */
import { normalizeMerchant } from './categorize';
import { addDays, addMonths, isISODate } from './dates';
import { detectRecurring } from './recurring';
import type { AppData, Bill, ISODate } from './types';

const step = (bill: Bill, due: ISODate): ISODate =>
  bill.cadence === 'monthly' ? addMonths(due, 1) : addDays(due, bill.cadence === 'weekly' ? 7 : 14);

/** A bill whose due date has passed moves to its next due date (it's assumed paid). */
export function rollBills(bills: readonly Bill[], today: ISODate): Bill[] {
  return bills.map((b) => {
    if (!isISODate(b.due) || !isISODate(today)) return b;
    let due = b.due;
    while (due < today) due = step(b, due);
    return due === b.due ? b : { ...b, due };
  });
}

/** Bills Annum noticed: repeated payments from checking that aren't bills yet. */
export function proposeBills(data: AppData): Bill[] {
  const checking = new Set(data.accounts.filter((a) => a.type === 'checking').map((a) => a.id));
  const known = new Set(data.bills.map((b) => normalizeMerchant(b.name)));
  return detectRecurring(
    data.transactions.filter((t) => checking.has(t.accountId)),
    data.today,
  )
    .filter((c) => !known.has(normalizeMerchant(c.merchant)))
    .map((c) => ({
      id: `bill-${normalizeMerchant(c.merchant).replace(/\s+/g, '-')}`,
      name: c.merchant,
      amount: c.amount,
      due: c.nextDue,
      cadence: c.cadence,
      confirmed: false,
      payFrom: 'checking' as const,
    }));
}

/** Proposals waiting for a yes or no (not confirmed, not dismissed). */
export const proposedBills = (bills: readonly Bill[]): Bill[] =>
  bills.filter((b) => !b.confirmed && !b.dismissed);
