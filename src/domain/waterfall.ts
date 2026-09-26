/** Deposit waterfall and split editing — docs/03 "Deposit waterfall". */
import { inNextDays } from './dates';
import { sum } from './money';
import { BUCKET_KEYS, type AppData, type BucketKey, type Buckets, type Cents } from './types';

export type Split = Buckets;
export type EditableBucket = Exclude<BucketKey, 'free'>;

export const splitTotal = (split: Split): Cents => sum(BUCKET_KEYS.map((k) => split[k]));

/** Tax applies to freelance/both income, and only while the Tax module is on. */
export const taxApplies = (data: AppData) =>
  data.settings.incomeType !== 'salary' && data.settings.modules.tax;

/** Confirmed bills due in the next 30 days (today through today + 30, inclusive). */
export const billsDueNext30 = (data: AppData): Cents =>
  sum(
    data.bills.filter((b) => b.confirmed && inNextDays(b.due, data.today, 30)).map((b) => b.amount),
  );

/**
 * Proposed split for a new deposit. Each step takes min(remaining, need):
 * Tax → Bills → Runway → Invest (only once Runway is full) → Free (the rest).
 */
export function proposeSplit(data: AppData, deposit: Cents): Split {
  let remaining = deposit;
  const take = (need: Cents): Cents => {
    const taken = Math.min(remaining, Math.max(0, need));
    remaining -= taken;
    return taken;
  };
  const tax = taxApplies(data) ? take(Math.round(deposit * data.settings.taxRate)) : 0;
  const bills = take(billsDueNext30(data) - data.buckets.bills);
  const runway = take(data.settings.runwayTarget - data.buckets.runway);
  const runwayFull = data.buckets.runway + runway >= data.settings.runwayTarget;
  const invest =
    data.settings.modules.invest && runwayFull
      ? take(Math.round(remaining * data.settings.investShare))
      : 0;
  return { tax, bills, runway, invest, free: remaining };
}

export interface SplitEdit {
  split: Split;
  /** True when the edit would have made Free negative, so the edited field was reduced instead. */
  capped: boolean;
}

/**
 * Change one amount. Free absorbs the difference so the total never changes.
 * If that would make Free negative, the edited field is reduced to what fits instead.
 */
export function editSplit(split: Split, field: EditableBucket, value: Cents): SplitEdit {
  const total = splitTotal(split);
  const others = sum(BUCKET_KEYS.filter((k) => k !== field && k !== 'free').map((k) => split[k]));
  const wanted = Math.max(0, Math.round(value));
  const fits = Math.max(0, total - others);
  const applied = Math.min(wanted, fits);
  return {
    split: { ...split, [field]: applied, free: total - others - applied },
    capped: applied < wanted,
  };
}
