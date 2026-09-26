/** First-run estimates and the unsplit preview — docs/03 "Estimates". */
import { calendarQuarter, inClosed } from './dates';
import { availableToSpend, savingsBalance, sum } from './money';
import { billsDueNext30, taxApplies, type Split } from './waterfall';
import type { AppData, Cents, ISODate } from './types';

/** Estimated spend: the ATS formula with Free = 0 (savings aren't split yet). */
export function estimatedSpend(data: AppData) {
  const ats = availableToSpend(data, 0);
  return {
    amount: ats.display,
    raw: ats.raw,
    perDay: ats.perDay,
    days: ats.days,
    nextIncome: ats.nextIncome,
  };
}

/** Savings ÷ monthly spend, rounded to the nearest whole month ("~6 months"). */
export function estimatedRunwayMonths(data: AppData): number {
  if (data.settings.monthlySpend <= 0) return 0;
  return Math.round(savingsBalance(data) / data.settings.monthlySpend);
}

/** Income received this calendar quarter: income transactions plus landed deposits, each counted once. */
export function incomeThisQuarter(data: AppData): {
  total: Cents;
  items: { date: ISODate; amount: Cents }[];
} {
  const q = calendarQuarter(data.today);
  const inQuarter = (d: ISODate) => inClosed(d, q.start, data.today);
  const fromTransactions = data.transactions
    .filter((t) => t.category === 'Income' && t.amount > 0 && inQuarter(t.date))
    .map((t) => ({ date: t.date, amount: t.amount }));
  const deposit = data.pendingDeposit;
  const fromDeposits =
    deposit &&
    inQuarter(deposit.date) &&
    !fromTransactions.some((t) => t.date === deposit.date && t.amount === deposit.amount)
      ? [{ date: deposit.date, amount: deposit.amount }]
      : [];
  const items = [...fromTransactions, ...fromDeposits];
  return { total: sum(items.map((i) => i.amount)), items };
}

/**
 * What a first split of the unsplit savings would look like (E3):
 * Tax on this quarter's income, Bills due in the next 30 days, the rest to Runway, Free 0.
 * The four always add up to the savings balance.
 */
export function unsplitPreview(data: AppData): Split {
  let remaining = savingsBalance(data);
  const take = (need: Cents): Cents => {
    const taken = Math.min(remaining, Math.max(0, need));
    remaining -= taken;
    return taken;
  };
  const tax = taxApplies(data)
    ? take(Math.round(data.settings.taxRate * incomeThisQuarter(data).total))
    : 0;
  const bills = take(billsDueNext30(data));
  return { tax, bills, runway: remaining, invest: 0, free: 0 };
}
