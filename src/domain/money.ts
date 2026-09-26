/** Core formulas — docs/03 "Core formulas". */
import { addDays, addMonths, daysBetween, inHalfOpen } from './dates';
import type { Account, AppData, Cents, ISODate, PaySchedule } from './types';

/** When no income is recorded at all, plan over this many days. (Decision: PROGRESS.md.) */
export const NO_INCOME_HORIZON_DAYS = 30;

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
/** Round cents down to whole dollars (per-day display rule). */
export const floorToDollar = (cents: Cents): Cents => Math.floor(cents / 100) * 100;
export const oneDecimal = (x: number): number => Math.round(x * 10) / 10;

export const accountsOfType = (data: AppData, type: Account['type']): Account[] =>
  data.accounts.filter((a) => a.type === type);
export const checkingBalance = (data: AppData): Cents =>
  sum(accountsOfType(data, 'checking').map((a) => a.balance));
export const savingsBalance = (data: AppData): Cents =>
  sum(accountsOfType(data, 'savings').map((a) => a.balance));

export interface NextIncome {
  date: ISODate;
  /** expected: an invoice · paycheck: salary · late: an invoice's date passed unpaid · none: nothing recorded. */
  kind: 'expected' | 'paycheck' | 'late' | 'none';
  source?: string;
  amount?: Cents;
  /** For kind 'late': the date it was due and how many days ago. */
  dueDate?: ISODate;
  daysLate?: number;
}

/** The next payday on or after `today`, stepping the schedule forward by its cadence. */
export function nextPayday(pay: PaySchedule, today: ISODate): ISODate {
  let next = pay.next;
  for (let k = 1; next < today; k++) {
    next =
      pay.cadence === 'monthly'
        ? addMonths(pay.next, k)
        : addDays(pay.next, k * (pay.cadence === 'weekly' ? 7 : 14));
  }
  return next;
}

/**
 * Salary: the next paycheck. Freelance: the earliest unreceived expected income on or after
 * today. If an unreceived invoice's date has passed, it's late: assume it arrives
 * `lateAssumeDays` after today (unless another income is due sooner) and flag it.
 * Both: whichever comes first, the paycheck or the invoice.
 */
export function nextIncome(data: AppData, today: ISODate = data.today): NextIncome {
  const pay = data.settings.paySchedule;
  const paycheck: NextIncome | undefined =
    pay && data.settings.incomeType !== 'freelance'
      ? { date: nextPayday(pay, today), kind: 'paycheck', amount: pay.amount }
      : undefined;
  if (data.settings.incomeType === 'salary' && paycheck) return paycheck;
  const invoice = nextInvoice(data, today);
  if (paycheck && (invoice.kind === 'none' || paycheck.date <= invoice.date)) return paycheck;
  return invoice;
}

function nextInvoice(data: AppData, today: ISODate): NextIncome {
  const unreceived = data.expectedIncome.filter((i) => !i.received);
  const upcoming = unreceived
    .filter((i) => i.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const overdue = unreceived
    .filter((i) => i.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (overdue) {
    const assumed = addDays(today, data.lateAssumeDays);
    if (!upcoming || upcoming.date > assumed) {
      return {
        date: assumed,
        kind: 'late',
        source: overdue.source,
        amount: overdue.amount,
        dueDate: overdue.date,
        daysLate: daysBetween(overdue.date, today),
      };
    }
  }
  if (upcoming) {
    return {
      date: upcoming.date,
      kind: 'expected',
      source: upcoming.source,
      amount: upcoming.amount,
    };
  }
  return { date: addDays(today, NO_INCOME_HORIZON_DAYS), kind: 'none' };
}

/** A bill or card statement that has to be paid from checking. */
export interface Obligation {
  kind: 'bill' | 'statement';
  id: string;
  name: string;
  amount: Cents;
  due: ISODate;
}

/** Confirmed checking bills and card statements due in [start, end). */
export function obligationsDue(data: AppData, start: ISODate, end: ISODate): Obligation[] {
  const bills: Obligation[] = data.bills
    .filter((b) => b.confirmed && b.payFrom === 'checking' && inHalfOpen(b.due, start, end))
    .map((b) => ({ kind: 'bill', id: b.id, name: b.name, amount: b.amount, due: b.due }));
  const statements: Obligation[] = accountsOfType(data, 'card')
    .filter((c) => (c.statementBalance ?? 0) > 0 && inHalfOpen(c.statementDue, start, end))
    .map((c) => ({
      kind: 'statement',
      id: c.id,
      name: c.name,
      amount: c.statementBalance ?? 0,
      due: c.statementDue as ISODate,
    }));
  return [...bills, ...statements].sort((a, b) => a.due.localeCompare(b.due));
}

/** Per day, rounded down to whole dollars. Income due today counts as 1 day, never 0. */
export const perDayFor = (amount: Cents, days: number): Cents =>
  floorToDollar(Math.max(amount, 0) / Math.max(days, 1));

export interface AvailableToSpend {
  /** Raw value, may be negative — rules use this. */
  raw: Cents;
  /** Floored at 0 — screens show this. */
  display: Cents;
  /** Calendar days from today to the next income date. */
  days: number;
  perDay: Cents;
  nextIncome: NextIncome;
  checking: Cents;
  free: Cents;
  /** Bills and statements due in [today, next income). */
  obligations: Obligation[];
}

/**
 * ATS = checking + Free − confirmed bills − card statements due in [today, next income).
 * Pass `free` to override the Free bucket (estimates use 0 while savings are unsplit).
 */
export function availableToSpend(data: AppData, free: Cents = data.buckets.free): AvailableToSpend {
  const income = nextIncome(data);
  const obligations = obligationsDue(data, data.today, income.date);
  const checking = checkingBalance(data);
  const raw = checking + free - sum(obligations.map((o) => o.amount));
  const days = daysBetween(data.today, income.date);
  return {
    raw,
    display: Math.max(raw, 0),
    days,
    perDay: perDayFor(raw, days),
    nextIncome: income,
    checking,
    free,
    obligations,
  };
}

/** Runway in months, one decimal. */
export function runwayMonths(data: AppData, runway: Cents = data.buckets.runway): number {
  if (data.settings.monthlySpend <= 0) return 0;
  return oneDecimal(runway / data.settings.monthlySpend);
}

/** Buckets must always add up to the savings balance. */
export const bucketTotal = (data: AppData): Cents => sum(Object.values(data.buckets));
