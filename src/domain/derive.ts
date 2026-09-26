/**
 * Real mode: values the fixtures carry precomputed (this week's spending, the tax year) are
 * derived from transactions here, and first-run data is built from onboarding answers.
 */
import { addDays, daysBetween, inClosed } from './dates';
import { rollBills } from './bills';
import { availableToSpend, sum } from './money';
import { fourWeekAverage, isSpending, summarizeSpending } from './report';
import { taxCategoryOf } from './review';
import type {
  Account,
  AppData,
  Bill,
  Buckets,
  Cents,
  ExpectedIncome,
  IncomeType,
  ISODate,
  PaySchedule,
  Settings,
  TaxYear,
  Transaction,
  WeekStart,
  WeekSummary,
} from './types';

export const EMPTY_BUCKETS: Buckets = { tax: 0, bills: 0, runway: 0, invest: 0, free: 0 };

/** Default months of spending the Runway target covers (O6 offers 3, 5 or 6). */
export const DEFAULT_RUNWAY_MONTHS = 5;
export const DEFAULT_TAX_RATE = 0.3;
export const DEFAULT_LATE_ASSUME_DAYS = 5;

/**
 * IRS estimated-tax due dates (nominal; the IRS moves a date that falls on a weekend or
 * holiday to the next business day). Q4 is due Jan 15 of the following year.
 */
export function nextQuarterlyDue(today: ISODate): ISODate {
  const year = Number(today.slice(0, 4));
  const dates = [`${year}-01-15`, `${year}-04-15`, `${year}-06-15`, `${year}-09-15`];
  return dates.find((d) => d >= today) ?? `${year + 1}-01-15`;
}

/** The review week runs from the last review (or the last 7 days before the first one). */
export const reviewWeekStart = (today: ISODate, weekStart?: WeekStart): ISODate =>
  weekStart && weekStart.date <= today ? weekStart.date : addDays(today, -6);

export function weekSummaryFrom(
  transactions: readonly Transaction[],
  start: ISODate,
  today: ISODate,
): WeekSummary {
  const { spent, byCategory } = summarizeSpending(transactions, start, today);
  return { start, spent, byCategory, fourWeekAvg: fourWeekAverage(transactions, start) };
}

/** Tax-tagged spending this calendar year, by tax category (money out counts as positive). */
export function taxYearFrom(transactions: readonly Transaction[], today: ISODate): TaxYear {
  const year = Number(today.slice(0, 4));
  const byCategory: Record<string, Cents> = {};
  const itemsByCategory: Record<string, number> = {};
  for (const t of transactions) {
    if (!t.tax || Number(t.date.slice(0, 4)) !== year) continue;
    const cat = taxCategoryOf(t);
    byCategory[cat] = (byCategory[cat] ?? 0) - t.amount;
    itemsByCategory[cat] = (itemsByCategory[cat] ?? 0) + 1;
  }
  return { year, byCategory, itemsByCategory, nextQuarterlyDue: nextQuarterlyDue(today) };
}

/** Recompute everything that depends on transactions and the date; passed bills roll forward. */
export function withDerived(data: AppData): AppData {
  const start = reviewWeekStart(data.today, data.weekStart);
  return {
    ...data,
    bills: rollBills(data.bills, data.today),
    thisWeek: weekSummaryFrom(data.transactions, start, data.today),
    taxYear: taxYearFrom(data.transactions, data.today),
  };
}

/**
 * Monthly spending learned from history: the last 90 days ÷ 3, once there are at least
 * 30 days of transactions. Undefined until then (the estimate stays what the user typed).
 */
export function learnedMonthlySpend(
  transactions: readonly Transaction[],
  today: ISODate,
): Cents | undefined {
  const dates = transactions.map((t) => t.date).sort();
  if (!dates.length || daysBetween(dates[0], today) < 30) return undefined;
  const from = addDays(today, -89);
  const spent = sum(
    transactions
      .filter((t) => isSpending(t) && inClosed(t.date, from, today))
      .map((t) => -t.amount),
  );
  const days = Math.min(90, daysBetween(dates[0], today) + 1);
  return Math.round((spent / days) * 30);
}

/** Snapshot at the start of a review week (06 What changed measures against it). */
export const weekStartSnapshot = (data: AppData): WeekStart => ({
  date: data.today,
  availableToSpend: availableToSpend(data).raw,
  runway: data.buckets.runway,
});

/** What onboarding collects. */
export interface FirstRunInput {
  today: ISODate;
  incomeType: IncomeType;
  accounts: Account[];
  transactions?: Transaction[];
  /** Bills proposed from history (demo connection now; recurring detection in M6). */
  bills?: Bill[];
  paySchedule?: PaySchedule;
  expectedIncome?: ExpectedIncome[];
  /** Typed in on the manual path; learned from history when there is some. */
  monthlySpend?: Cents;
}

export const modulesFor = (incomeType: IncomeType): Settings['modules'] => ({
  tax: incomeType !== 'salary',
  debt: false,
  invest: true,
});

/**
 * First-run data: estimate mode, savings not split yet (every bucket 0), Runway target
 * 5 × monthly spending, tax 30% for freelance income. Bills are proposed later from history.
 */
export function newAppData(input: FirstRunInput): AppData {
  const transactions = input.transactions ?? [];
  const monthlySpend = input.monthlySpend ?? learnedMonthlySpend(transactions, input.today) ?? 0;
  const settings: Settings = {
    incomeType: input.incomeType,
    taxRate: input.incomeType === 'salary' ? 0 : DEFAULT_TAX_RATE,
    runwayTarget: monthlySpend * DEFAULT_RUNWAY_MONTHS,
    monthlySpend,
    habitTransfer: { amount: 0, cadence: 'weekly' },
    modules: modulesFor(input.incomeType),
    isEstimate: true,
    investShare: 0.5,
    ...(input.paySchedule ? { paySchedule: input.paySchedule } : {}),
  };
  return withDerived({
    today: input.today,
    settings,
    accounts: input.accounts,
    buckets: { ...EMPTY_BUCKETS },
    bills: input.bills ?? [],
    expectedIncome: input.expectedIncome ?? [],
    transactions,
    lateAssumeDays: DEFAULT_LATE_ASSUME_DAYS,
    savingsUnsplit: true,
  });
}
