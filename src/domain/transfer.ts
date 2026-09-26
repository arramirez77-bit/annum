/** Weekly transfer suggestion — docs/03. */
import { addDays } from './dates';
import { availableToSpend, obligationsDue, sum, type Obligation } from './money';
import type { AppData, Cents } from './types';

export interface TransferSuggestion {
  /** Bills and card statements due in the next 7 days (today through today + 7). */
  due: Obligation[];
  /** perDay × 7. */
  spending: Cents;
  total: Cents;
  habit: Cents;
  /** total − habit: positive = this week needs more than usual. */
  difference: Cents;
}

export function weeklyTransfer(data: AppData): TransferSuggestion {
  // obligationsDue is half-open, so end at today + 8 to include today + 7.
  const due = obligationsDue(data, data.today, addDays(data.today, 8));
  const spending = availableToSpend(data).perDay * 7;
  const total = sum(due.map((o) => o.amount)) + spending;
  const habit = data.settings.habitTransfer.amount;
  return { due, spending, total, habit, difference: total - habit };
}

/** Offer to lower the habit when the suggestion was below it 3 weeks in a row. */
export function shouldOfferLowerHabit(recentSuggestions: readonly Cents[], habit: Cents): boolean {
  const lastThree = recentSuggestions.slice(-3);
  return lastThree.length === 3 && lastThree.every((s) => s < habit);
}
