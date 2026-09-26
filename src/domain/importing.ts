/**
 * Adding imported transactions (S11): skip ones Annum already has, fill category suggestions
 * (rules first), and recognise expected income that arrived. Pure; the store applies the result.
 */
import { applyRules, normalizeMerchant, type CategoryRule } from './categorize';
import type { ImportedTransaction } from './csv';
import { addDays, inClosed } from './dates';
import { suggestCategory } from './suggest';
import type { AppData, Deposit, ExpectedIncome, ISODate, Transaction } from './types';

/**
 * Banks often send names in capitals ("RENT PAYMENT - CITY HOMES"); show them in title case.
 * Mixed-case names are kept as the bank wrote them, and codes with digits stay as they are.
 */
export function tidyMerchant(name: string): string {
  if (name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name
    .split(' ')
    .map((w) => (/\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

const key = (t: { date: ISODate; amount: number; merchant: string }) =>
  `${t.date}|${t.amount}|${normalizeMerchant(t.merchant)}`;

export interface MergeResult {
  transactions: Transaction[];
  added: Transaction[];
  duplicates: number;
  range?: { from: ISODate; to: ISODate };
}

/**
 * Dedupe against the account's transactions: by the bank's id when both have one, otherwise by
 * date + amount + merchant — counted, so two identical coffees on one day both stay.
 */
export function mergeImport(
  existing: readonly Transaction[],
  incoming: readonly ImportedTransaction[],
  accountId: string,
  rules: readonly CategoryRule[],
  newId: () => string,
): MergeResult {
  const mine = existing.filter((t) => t.accountId === accountId);
  const ids = new Set(mine.map((t) => t.externalId).filter(Boolean));
  // How many of each date+amount+merchant are already here: all of them, and those without a
  // bank id (a bank id that differs means a different transaction, even if it looks the same).
  const all = new Map<string, number>();
  const noId = new Map<string, number>();
  for (const t of mine) {
    all.set(key(t), (all.get(key(t)) ?? 0) + 1);
    if (!t.externalId) noId.set(key(t), (noId.get(key(t)) ?? 0) + 1);
  }
  const consume = (counts: Map<string, number>, k: string) => {
    const n = counts.get(k) ?? 0;
    if (n > 0) counts.set(k, n - 1);
    return n > 0;
  };

  const fresh: Transaction[] = [];
  let duplicates = 0;
  for (const t of incoming) {
    const k = key(t);
    const duplicate = t.externalId ? ids.has(t.externalId) || consume(noId, k) : consume(all, k);
    if (duplicate) {
      duplicates++;
      continue;
    }
    fresh.push({
      id: newId(),
      accountId,
      date: t.date,
      merchant: tidyMerchant(t.merchant),
      amount: t.amount,
      ...(t.externalId ? { externalId: t.externalId } : {}),
      tax: false,
      reviewed: false,
      ...(suggestCategory(t.merchant, t.amount)
        ? { suggestedCategory: suggestCategory(t.merchant, t.amount) }
        : {}),
    });
  }
  const added = applyRules(fresh, rules);
  const dates = incoming.map((t) => t.date).sort();
  return {
    transactions: [...existing, ...added],
    added,
    duplicates,
    ...(dates.length ? { range: { from: dates[0], to: dates[dates.length - 1] } } : {}),
  };
}

/** Within this share of the expected amount counts as the invoice (fees, rounding). */
export const INCOME_TOLERANCE = 0.1;
/** How far before its date an invoice can land, and how late it can still be matched. */
export const INCOME_EARLY_DAYS = 10;
export const INCOME_LATE_DAYS = 45;

export interface IncomeMatch {
  expected: ExpectedIncome;
  transaction: Transaction;
}

/** Expected income that arrived: money in, close to the amount, near the date. */
export function matchIncome(
  expected: readonly ExpectedIncome[],
  added: readonly Transaction[],
): IncomeMatch[] {
  const used = new Set<string>();
  const matches: IncomeMatch[] = [];
  for (const e of expected.filter((x) => !x.received)) {
    const t = added.find(
      (a) =>
        !used.has(a.id) &&
        a.amount > 0 &&
        Math.abs(a.amount - e.amount) <= e.amount * INCOME_TOLERANCE &&
        inClosed(a.date, addDays(e.date, -INCOME_EARLY_DAYS), addDays(e.date, INCOME_LATE_DAYS)),
    );
    if (!t) continue;
    used.add(t.id);
    matches.push({ expected: e, transaction: t });
  }
  return matches;
}

/** The deposit Money offers to split: the oldest one still waiting, else the latest. */
export function currentDeposit(deposits: readonly Deposit[]): Deposit | undefined {
  const sorted = [...deposits].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((d) => !d.confirmed) ?? sorted[sorted.length - 1];
}

/**
 * Apply an import to AppData: new transactions, income marked received (and categorised), and a
 * deposit to split for each invoice that landed in savings. A deposit still waiting to be split
 * is never replaced; new ones queue behind it.
 */
export function applyImport(
  data: AppData,
  merge: MergeResult,
): { data: AppData; deposits: Deposit[]; received: IncomeMatch[] } {
  const matches = matchIncome(data.expectedIncome, merge.added);
  const byTxn = new Map(matches.map((m) => [m.transaction.id, m]));
  const transactions = merge.transactions.map((t) =>
    byTxn.has(t.id) ? { ...t, suggestedCategory: 'Income' } : t,
  );
  const expectedIncome = data.expectedIncome.map((e) =>
    matches.some((m) => m.expected.id === e.id) ? { ...e, received: true } : e,
  );
  const savingsIds = new Set(data.accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  const deposits: Deposit[] = matches
    .filter((m) => savingsIds.has(m.transaction.accountId))
    .map((m) => ({
      id: `deposit-${m.transaction.id}`,
      date: m.transaction.date,
      amount: m.transaction.amount,
      source: m.expected.source,
      confirmed: false,
      inBalance: true,
    }));
  const waiting =
    data.pendingDeposit && !data.pendingDeposit.confirmed ? data.pendingDeposit : undefined;
  const pendingDeposit = waiting ?? currentDeposit(deposits);
  return {
    data: { ...data, transactions, expectedIncome, ...(pendingDeposit ? { pendingDeposit } : {}) },
    deposits,
    received: matches,
  };
}
