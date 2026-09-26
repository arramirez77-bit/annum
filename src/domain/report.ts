/** Weekly report, "What changed", and the Taxes summary — docs/03 "Weekly report". */
import { addDays, daysBetween, inClosed, inHalfOpen } from './dates';
import { availableToSpend, nextIncome, oneDecimal, perDayFor, sum } from './money';
import type { AppData, Cents, ISODate, Transaction, WeekSummary } from './types';

export type UsualLabel = 'more than usual' | 'about usual' | 'less than usual';

/** Categories that move money around rather than spend it. */
export const NOT_SPENDING = new Set(['Income', 'Transfer', 'Card payment', 'Savings']);

/** An outflow that counts as spending: money out, posted (not pending), not a transfer. */
export const isSpending = (t: Transaction): boolean =>
  t.amount < 0 && !t.pending && !NOT_SPENDING.has(t.category ?? t.suggestedCategory ?? '');

/** > +20% more than usual, < −20% less than usual, else about usual. */
export function usualLabel(amount: Cents, average: Cents): UsualLabel {
  if (average <= 0) return amount > 0 ? 'more than usual' : 'about usual';
  const change = (amount - average) / average;
  if (change > 0.2) return 'more than usual';
  if (change < -0.2) return 'less than usual';
  return 'about usual';
}

/** Spending by category over [start, end] from transactions (used once real data syncs). */
export function summarizeSpending(
  transactions: readonly Transaction[],
  start: ISODate,
  end: ISODate,
) {
  const byCategory: Record<string, Cents> = {};
  for (const t of transactions) {
    if (!isSpending(t) || !inClosed(t.date, start, end)) continue;
    const cat = t.category ?? t.suggestedCategory ?? 'Other';
    byCategory[cat] = (byCategory[cat] ?? 0) - t.amount;
  }
  return { spent: sum(Object.values(byCategory)), byCategory };
}

/** Average weekly spend per category over the 4 weeks before `weekStart`. */
export function fourWeekAverage(transactions: readonly Transaction[], weekStart: ISODate) {
  const { byCategory } = summarizeSpending(
    transactions,
    addDays(weekStart, -28),
    addDays(weekStart, -1),
  );
  return Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v / 4)]));
}

/** Per day × 7 as it stood at the start of the week. */
export function weekAllowance(data: AppData) {
  if (!data.weekStart) {
    const perDay = availableToSpend(data).perDay;
    return { perDayAtStart: perDay, days: availableToSpend(data).days, allowance: perDay * 7 };
  }
  const days = daysBetween(data.weekStart.date, nextIncome(data, data.weekStart.date).date);
  const perDayAtStart = perDayFor(data.weekStart.availableToSpend, days);
  return { perDayAtStart, days, allowance: perDayAtStart * 7 };
}

export interface CategoryLine {
  category: string;
  amount: Cents;
  average: Cents;
  /** Percent change vs the 4-week average, one decimal. */
  changePct: number;
  label: UsualLabel;
}

export interface WeekReport {
  spent: Cents;
  allowance: Cents;
  perDayAtStart: Cents;
  /** spent − allowance: positive = over. */
  overBy: Cents;
  topCategories: CategoryLine[];
}

export function weekReport(
  data: AppData,
  summary: WeekSummary | undefined = data.thisWeek,
): WeekReport {
  const { allowance, perDayAtStart } = weekAllowance(data);
  const spent = summary?.spent ?? 0;
  const topCategories = Object.entries(summary?.byCategory ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => {
      const average = summary?.fourWeekAvg[category] ?? 0;
      return {
        category,
        amount,
        average,
        changePct: average > 0 ? oneDecimal(((amount - average) / average) * 100) : 0,
        label: usualLabel(amount, average),
      };
    });
  return { spent, allowance, perDayAtStart, overBy: spent - allowance, topCategories };
}

/** The category furthest from its 4-week average (06 "notable change"). */
export function notableCategory(report: WeekReport): CategoryLine | undefined {
  return [...report.topCategories].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
}

/** Changes since the start of the week (06 What changed, Today's Runway subtitle). */
export function weeklyChanges(data: AppData) {
  if (!data.weekStart) return undefined;
  return {
    /** ATS now − ATS at the start of the week. */
    freeToSpend: availableToSpend(data).raw - data.weekStart.availableToSpend,
    /** Runway change in months, one decimal. */
    runwayMonths:
      data.settings.monthlySpend > 0
        ? oneDecimal((data.buckets.runway - data.weekStart.runway) / data.settings.monthlySpend)
        : 0,
  };
}

/** S2 Taxes: tagged total and each tax category's total and item count. */
export function taxSummary(data: AppData) {
  const byCategory = data.taxYear?.byCategory ?? {};
  const items = data.taxYear?.itemsByCategory ?? {};
  const categories = Object.entries(byCategory).map(([name, total]) => ({
    name,
    total,
    items: items[name] ?? 0,
  }));
  return {
    total: sum(categories.map((c) => c.total)),
    items: sum(categories.map((c) => c.items)),
    categories,
  };
}

/** Tax-tagged transactions in [start, end), for the accountant export. */
export const taxTransactions = (
  transactions: readonly Transaction[],
  start: ISODate,
  end: ISODate,
) => transactions.filter((t) => t.tax && inHalfOpen(t.date, start, end));
