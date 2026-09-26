/**
 * Recurring-bill detection: propose bills from repeated outflows. Proposals are unconfirmed
 * until the user confirms them. (Thresholds are decisions logged in PROGRESS.md.)
 */
import { addDays, addMonths, daysBetween } from './dates';
import { normalizeMerchant } from './categorize';
import type { Cadence, Cents, ISODate, Transaction } from './types';

export const MIN_OCCURRENCES = 3;
/** Amounts within this share of the typical amount count as "the same bill". */
export const AMOUNT_TOLERANCE = 0.1;

const CADENCES: { cadence: Cadence; min: number; max: number; days: number }[] = [
  { cadence: 'weekly', min: 6, max: 8, days: 7 },
  { cadence: 'biweekly', min: 13, max: 15, days: 14 },
  { cadence: 'monthly', min: 27, max: 32, days: 30 },
];

export interface RecurringCandidate {
  merchant: string;
  /** Typical amount, positive cents. */
  amount: Cents;
  cadence: Cadence;
  lastDate: ISODate;
  nextDue: ISODate;
  occurrences: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export function detectRecurring(
  transactions: readonly Transaction[],
  today: ISODate,
): RecurringCandidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount >= 0 || t.pending) continue;
    const key = normalizeMerchant(t.merchant);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: RecurringCandidate[] = [];
  for (const txs of groups.values()) {
    if (txs.length < MIN_OCCURRENCES) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const amount = median(sorted.map((t) => -t.amount));
    if (!sorted.every((t) => Math.abs(-t.amount - amount) <= amount * AMOUNT_TOLERANCE)) continue;

    const gaps = sorted.slice(1).map((t, i) => daysBetween(sorted[i].date, t.date));
    const match = CADENCES.find((c) => gaps.every((g) => g >= c.min && g <= c.max));
    if (!match) continue;

    const last = sorted[sorted.length - 1];
    // Stopped: nothing for more than two cycles.
    if (daysBetween(last.date, today) > match.days * 2) continue;
    const nextDue =
      match.cadence === 'monthly' ? addMonths(last.date, 1) : addDays(last.date, match.days);
    found.push({
      merchant: last.merchant,
      amount,
      cadence: match.cadence,
      lastDate: last.date,
      nextDue,
      occurrences: sorted.length,
    });
  }
  return found.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}
