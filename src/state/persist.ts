/**
 * Between the store and the repository: which parts of the app state are saved, and how a saved
 * file becomes AppData again. Pure (no React Native), so a save→load round trip is unit-tested.
 */
import type {
  BankConnection,
  PendingTransfer,
  Prefs,
  ReviewRecord,
  SplitRecord,
  Stored,
} from '@/data/repo';
import {
  currentDeposit,
  withDerived,
  type AppData,
  type CategoryRule,
  type DeferredPurchase,
  type Deposit,
  type InvestMove,
  type ISODate,
} from '@/domain';

/** The slice of AppState that is saved. */
export interface Persisted {
  data: AppData;
  prefs: Prefs;
  deposits: Deposit[];
  splits: SplitRecord[];
  reviews: ReviewRecord[];
  rules: CategoryRule[];
  deferred: DeferredPurchase[];
  /** Bank connections (M7), with their access tokens: never shown or logged. */
  connections: BankConnection[];
  reviewStep: number;
  pendingTransfer: PendingTransfer | null;
  investMoves: InvestMove[];
  startedOn: ISODate | null;
}

export const PERSISTED_KEYS: readonly (keyof Persisted)[] = [
  'data',
  'prefs',
  'deposits',
  'splits',
  'reviews',
  'rules',
  'deferred',
  'connections',
  'reviewStep',
  'pendingTransfer',
  'investMoves',
  'startedOn',
];

/** The deposit history, with the current deposit's latest state folded in. */
export function depositsWith(deposits: readonly Deposit[], current?: Deposit): Deposit[] {
  if (!current) return [...deposits];
  const found = deposits.some((d) => d.id === current.id);
  return found ? deposits.map((d) => (d.id === current.id ? current : d)) : [...deposits, current];
}

export function storedFrom(p: Persisted): Stored {
  const { data } = p;
  return {
    settings: data.settings,
    prefs: p.prefs,
    accounts: data.accounts,
    buckets: data.buckets,
    bills: data.bills,
    expectedIncome: data.expectedIncome,
    transactions: data.transactions,
    deposits: depositsWith(p.deposits, data.pendingDeposit),
    splits: p.splits,
    reviews: p.reviews,
    rules: p.rules,
    deferred: p.deferred,
    connections: p.connections,
    ...(data.weekStart ? { weekStart: data.weekStart } : {}),
    savingsUnsplit: data.savingsUnsplit,
    lateAssumeDays: data.lateAssumeDays,
    reviewStep: p.reviewStep,
    pendingTransfer: p.pendingTransfer,
    investMoves: p.investMoves,
    startedOn: p.startedOn ?? data.today,
  };
}

export function persistedFrom(stored: Stored, today: ISODate): Persisted {
  const pendingDeposit = currentDeposit(stored.deposits);
  const data: AppData = withDerived({
    today,
    settings: stored.settings,
    accounts: stored.accounts,
    buckets: stored.buckets,
    bills: stored.bills,
    expectedIncome: stored.expectedIncome,
    transactions: stored.transactions,
    ...(stored.weekStart ? { weekStart: stored.weekStart } : {}),
    ...(pendingDeposit ? { pendingDeposit } : {}),
    lateAssumeDays: stored.lateAssumeDays,
    savingsUnsplit: stored.savingsUnsplit,
  });
  return {
    data,
    prefs: stored.prefs,
    deposits: stored.deposits,
    splits: stored.splits,
    reviews: stored.reviews,
    rules: stored.rules,
    deferred: stored.deferred,
    connections: stored.connections,
    reviewStep: stored.reviewStep,
    pendingTransfer: stored.pendingTransfer,
    investMoves: stored.investMoves ?? [],
    startedOn: stored.startedOn,
  };
}

/** The last finished review, for "This week is reviewed". */
export const lastReviewDate = (reviews: readonly ReviewRecord[]): ISODate | null =>
  reviews.reduce<ISODate | null>(
    (latest, r) => (!latest || r.date > latest ? r.date : latest),
    null,
  );

/**
 * Restoring a backup keeps the bank connections this phone has that the backup doesn't (made
 * after it, or earlier in this setup): each counts against the 10 and can't be made again, so
 * its access is never dropped. Their accounts and transactions aren't in the backup, so they
 * start over: the next sync brings their history in again (as history, already reviewed).
 */
export function connectionsKeptThroughRestore(
  current: readonly BankConnection[],
  restored: readonly BankConnection[],
): BankConnection[] {
  const inBackup = new Set(restored.map((c) => c.itemId));
  return current
    .filter((c) => !inBackup.has(c.itemId) && (!!c.accessToken || c.status === 'exchanging'))
    .map(({ lastSynced: _synced, historyDone: _done, ...c }) => ({ ...c, cursor: null }));
}
