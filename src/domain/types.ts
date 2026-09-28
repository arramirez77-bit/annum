/** Domain types — docs/03-DATA-MODEL.md. All money is integer cents; dates are local calendar dates. */

export type Cents = number;
/** 'YYYY-MM-DD', a local calendar date (never a timestamp). */
export type ISODate = string;
export type IncomeType = 'freelance' | 'salary' | 'both';
export type BucketKey = 'tax' | 'bills' | 'runway' | 'invest' | 'free';
export type Cadence = 'weekly' | 'biweekly' | 'monthly';

/** Fixed bucket order: the mark's arcs clockwise from 12, and the deposit split order. */
export const BUCKET_KEYS: readonly BucketKey[] = ['tax', 'bills', 'runway', 'invest', 'free'];

export interface PaySchedule {
  amount: Cents;
  cadence: Cadence;
  next: ISODate;
}

export interface Settings {
  incomeType: IncomeType;
  /** 0.25 | 0.30 | 0.35 (freelance/both only). */
  taxRate: number;
  runwayTarget: Cents;
  /** Estimated, then learned from 90 days of spending. */
  monthlySpend: Cents;
  habitTransfer: { amount: Cents; cadence: Cadence };
  modules: { tax: boolean; debt: boolean; invest: boolean };
  /** True until the first weekly review completes. */
  isEstimate: boolean;
  /** Share of what's left that goes to Invest once Runway is full (default 0.5). */
  investShare: number;
  /** Salary: the pay schedule that defines "next income". */
  paySchedule?: PaySchedule;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'card' | 'brokerage' | 'loan';
  /** Cards and loans: amount owed, positive. */
  balance: Cents;
  statementBalance?: Cents;
  statementDue?: ISODate | null;
  /** ISO datetime of the last sync. */
  lastSynced?: string;
  /** Accounts entered by hand: the day the balance was last typed in. */
  enteredOn?: ISODate;
  /** Imported accounts: the last 4 digits from the bank file, to match the next file. */
  last4?: string;
  /**
   * plaid: a bank connection (Plaid Trial, M7) · import: CSV/OFX files · manual: typed in ·
   * demo: the sample bank in development builds (stands in for a bank connection).
   */
  source: 'plaid' | 'import' | 'manual' | 'demo';
  /** Plaid's id for this account, and for the bank login (Item) it belongs to. */
  plaidAccountId?: string;
  itemId?: string;
  /**
   * An account that came from bank files before its bank was connected: the last date the
   * files covered. Bank transactions on or before it are already here.
   */
  importedThrough?: ISODate;
  status: 'ok' | 'stale' | 'disconnected';
}

/** Labels on the savings account. Invariant: the five add up to the savings balance. */
export type Buckets = Record<BucketKey, Cents>;

export interface Bill {
  id: string;
  name: string;
  amount: Cents;
  due: ISODate;
  cadence: Cadence;
  confirmed: boolean;
  payFrom: 'checking';
  /** A proposal the user said isn't a bill; it isn't proposed again. */
  dismissed?: boolean;
}

export interface ExpectedIncome {
  id: string;
  source: string;
  amount: Cents;
  date: ISODate;
  received?: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: ISODate;
  merchant: string;
  /** Negative = money out. */
  amount: Cents;
  category?: string;
  suggestedCategory?: string;
  tax: boolean;
  taxCategory?: string;
  reviewed: boolean;
  pending?: boolean;
  /** The bank's id for it (OFX FITID, later a bank-sync id), used to skip duplicates. */
  externalId?: string;
}

export interface Deposit {
  id: string;
  date: ISODate;
  amount: Cents;
  source?: string;
  split?: Buckets;
  confirmed: boolean;
  /** Imported: the account balance already includes it, so confirming doesn't add it again. */
  inBalance?: boolean;
}

export interface DeferredPurchase {
  id: string;
  label: string;
  amount: Cents;
  waitUntil: ISODate;
  status: 'waiting' | 'bought' | 'dropped';
}

export type TodayStatus = 'on-track' | 'heads-up' | 'estimate';

/** Snapshot saved when the review week starts. */
export interface WeekStart {
  date: ISODate;
  availableToSpend: Cents;
  runway: Cents;
}

/** Spending this review week, by category, plus each category's 4-week average. */
export interface WeekSummary {
  start: ISODate;
  spent: Cents;
  byCategory: Record<string, Cents>;
  fourWeekAvg: Record<string, Cents>;
}

export interface TaxYear {
  year: number;
  byCategory: Record<string, Cents>;
  itemsByCategory: Record<string, number>;
  nextQuarterlyDue: ISODate;
}

/** Everything the engine needs to answer "how much can I spend today?". */
export interface AppData {
  today: ISODate;
  settings: Settings;
  accounts: Account[];
  buckets: Buckets;
  bills: Bill[];
  expectedIncome: ExpectedIncome[];
  transactions: Transaction[];
  weekStart?: WeekStart;
  thisWeek?: WeekSummary;
  taxYear?: TaxYear;
  pendingDeposit?: Deposit;
  /** Days after today a late invoice is assumed to arrive (default 5). */
  lateAssumeDays: number;
  /** True while savings haven't been split into buckets yet (first run). */
  savingsUnsplit: boolean;
}
