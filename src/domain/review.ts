/** Weekly review, deposit confirmation and exports — pure functions over AppData (docs/03, docs/05). */
import { addDays, daysBetween, inClosed } from './dates';
import { savingsBalance, sum } from './money';
import { splitTotal, type Split } from './waterfall';
import type { AppData, Cents, ISODate, TaxYear, Transaction } from './types';

/** Next review day: the next Sunday after today ("Next review Sunday, Sep 27"). */
export function nextReviewDate(today: ISODate): ISODate {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, weekday === 0 ? 7 : 7 - weekday);
}

/** Unreviewed transactions this review week (step 2, "Tag"). */
export function toTag(data: AppData): Transaction[] {
  const start = data.thisWeek?.start ?? addDays(data.today, -6);
  return data.transactions.filter((t) => !t.reviewed && inClosed(t.date, start, data.today));
}

/** The category a transaction counts under for taxes. */
export const taxCategoryOf = (t: Transaction): string =>
  t.taxCategory ?? t.category ?? t.suggestedCategory ?? 'Other';

/**
 * Taxes totals after tagging: start from the year's totals and apply each transaction whose
 * tax tag changed (tagged → add to its category, untagged → take it off).
 */
export function applyTaxChanges(
  taxYear: TaxYear,
  before: readonly Transaction[],
  after: readonly Transaction[],
): TaxYear {
  const byCategory = { ...taxYear.byCategory };
  const items = { ...taxYear.itemsByCategory };
  const was = new Map(before.map((t) => [t.id, t]));
  for (const t of after) {
    const old = was.get(t.id);
    if (!old || old.tax === t.tax) continue;
    const cat = taxCategoryOf(t.tax ? t : old);
    const sign = t.tax ? 1 : -1;
    byCategory[cat] = Math.max((byCategory[cat] ?? 0) + sign * -t.amount, 0);
    items[cat] = Math.max((items[cat] ?? 0) + sign, 0);
    if (items[cat] === 0 && byCategory[cat] === 0) {
      delete byCategory[cat];
      delete items[cat];
    }
  }
  return { ...taxYear, byCategory, itemsByCategory: items };
}

/**
 * Confirm a deposit split: the deposit lands in savings and each bucket grows by its share,
 * so buckets still add up to savings. `landed` false means the money was already in savings
 * (the first split of unsplit savings), so only the buckets change.
 */
export function confirmSplit(data: AppData, split: Split, landed: boolean): AppData {
  const amount = splitTotal(split);
  let credited = false;
  const accounts = data.accounts.map((a) => {
    if (!landed || credited || a.type !== 'savings') return a;
    credited = true;
    return { ...a, balance: a.balance + amount };
  });
  const buckets = { ...data.buckets };
  for (const k of Object.keys(buckets) as (keyof Split)[]) buckets[k] += split[k];
  return {
    ...data,
    accounts,
    buckets,
    savingsUnsplit: false,
    pendingDeposit:
      landed && data.pendingDeposit
        ? { ...data.pendingDeposit, confirmed: true, split }
        : data.pendingDeposit,
  };
}

/** The spent-vs-allowance bar on "Week reviewed": the allowance part, plus any overflow. */
export function spendBar(spent: Cents, allowance: Cents) {
  const within = Math.min(spent, allowance);
  return { within, over: Math.max(spent - allowance, 0), left: Math.max(allowance - spent, 0) };
}

/** Weeks since a date, for "Last reviewed 2 weeks ago". */
export const weeksSince = (from: ISODate, today: ISODate) =>
  Math.floor(daysBetween(from, today) / 7);

const csvCell = (value: string | number) => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Tax-tagged transactions as CSV for the accountant (amounts as positive dollars with cents). */
export function taxCsv(data: AppData, year: number): string {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const rows = data.transactions
    .filter((t) => t.tax && t.date.startsWith(String(year)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [
        t.date,
        t.merchant,
        taxCategoryOf(t),
        (Math.abs(t.amount) / 100).toFixed(2),
        accounts.get(t.accountId) ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  return ['Date,Merchant,Tax category,Amount (USD),Account', ...rows].join('\n') + '\n';
}

/** Savings balance after a split, for checking the invariant in tests and screens. */
export const bucketsMatchSavings = (data: AppData) =>
  sum(Object.values(data.buckets)) === savingsBalance(data);
