/**
 * Adding what a connected bank sends (M7): new, changed and removed transactions since the last
 * sync, with pending ones replaced by their posted version. Pure; the store applies the result
 * the same way as a file import (income matching, bills), see importing.ts.
 */
import { applyRules, type CategoryRule } from './categorize';
import { tidyMerchant, type MergeResult } from './importing';
import { suggestCategory } from './suggest';
import type { Account, Cents, ISODate, Transaction } from './types';

/** One transaction as a connected bank reports it, already in Annum's units. */
export interface BankTransaction {
  /** The bank's id (Plaid transaction_id): transactions are matched by it, never by name. */
  externalId: string;
  accountExternalId: string;
  date: ISODate;
  merchant: string;
  /** Negative = money out. */
  amount: Cents;
  pending: boolean;
  /** Posted: the pending transaction it replaces. */
  replaces?: string;
  /** The bank's own category, in Annum's words. A rule the user set still wins. */
  categoryHint?: string;
}

export interface BankChanges {
  added: readonly BankTransaction[];
  modified: readonly BankTransaction[];
  /** External ids of transactions the bank dropped (e.g. a pending charge that fell off). */
  removed: readonly string[];
}

export interface BankMergeResult extends MergeResult {
  /** Transactions the bank dropped. */
  removed: number;
}

export interface BankMergeOptions {
  /**
   * Transactions dated before this arrive already reviewed: a new connection brings up to two
   * years of history, which shouldn't all wait in "Needs a look".
   */
  reviewedBefore?: ISODate;
}

/** Money in can only be Income, a transfer or a card payment; money out can't be Income. */
function fits(category: string | undefined, amount: Cents): category is string {
  if (!category) return false;
  if (amount > 0) return ['Income', 'Transfer', 'Card payment'].includes(category);
  return category !== 'Income';
}

/**
 * Merge a bank's changes into the transactions Annum has. Accounts are found by the bank's
 * account id; transactions for accounts Annum doesn't track are ignored. What the person set
 * (category, work expense, reviewed) survives when a transaction changes or posts.
 */
export function mergeBankChanges(
  existing: readonly Transaction[],
  changes: BankChanges,
  accounts: readonly Account[],
  rules: readonly CategoryRule[],
  newId: () => string,
  options: BankMergeOptions = {},
): BankMergeResult {
  const byBankAccount = new Map(
    accounts.filter((a) => a.plaidAccountId).map((a) => [a.plaidAccountId as string, a]),
  );
  const transactions = [...existing];
  const at = new Map<string, number>();
  transactions.forEach((t, i) => {
    if (t.externalId) at.set(t.externalId, i);
  });

  const fresh: Transaction[] = [];
  const posted: Transaction[] = [];
  const replaced = new Set<string>();
  let duplicates = 0;
  const dates: ISODate[] = [];

  for (const b of [...changes.added, ...changes.modified]) {
    const account = byBankAccount.get(b.accountExternalId);
    if (!account) continue;
    const cutoff = account.importedThrough;
    if (cutoff && b.date <= cutoff && !at.has(b.externalId)) {
      duplicates++;
      continue;
    }
    dates.push(b.date);
    const merchant = tidyMerchant(b.merchant);
    const own = at.get(b.externalId);
    const pendingOne = b.replaces !== undefined ? at.get(b.replaces) : undefined;
    const index = own ?? pendingOne;
    if (index !== undefined) {
      // A change, or a pending charge that posted: keep the person's choices.
      const { pending: _was, ...prior } = transactions[index];
      const next: Transaction = {
        ...prior,
        accountId: account.id,
        date: b.date,
        merchant,
        amount: b.amount,
        externalId: b.externalId,
        ...(b.pending ? { pending: true } : {}),
      };
      transactions[index] = next;
      at.set(b.externalId, index);
      if (own === undefined && b.replaces !== undefined) {
        at.delete(b.replaces);
        replaced.add(b.replaces);
        if (!b.pending) posted.push(next);
      }
      continue;
    }
    const suggestion = fits(b.categoryHint, b.amount)
      ? b.categoryHint
      : suggestCategory(merchant, b.amount);
    const t: Transaction = {
      id: newId(),
      accountId: account.id,
      date: b.date,
      merchant,
      amount: b.amount,
      externalId: b.externalId,
      tax: false,
      reviewed: !!options.reviewedBefore && b.date < options.reviewedBefore,
      ...(b.pending ? { pending: true } : {}),
      ...(suggestion ? { suggestedCategory: suggestion } : {}),
    };
    at.set(b.externalId, transactions.length);
    transactions.push(t);
    fresh.push(t);
  }

  const drop = new Set(changes.removed.filter((id) => !replaced.has(id)));
  const kept = transactions.filter((t) => !t.externalId || !drop.has(t.externalId));
  const removed = transactions.length - kept.length;

  // Rules fill suggestions on the new ones (a rule beats the bank's category).
  const ruled = new Map(applyRules(fresh, rules).map((t) => [t.id, t]));
  const merged = kept.map((t) => ruled.get(t.id) ?? t);
  const addedIds = new Set([...fresh, ...posted].map((t) => t.id));
  dates.sort();
  return {
    transactions: merged,
    // New and newly posted transactions: expected income is matched against these.
    added: merged.filter((t) => addedIds.has(t.id) && !t.pending),
    duplicates,
    removed,
    ...(dates.length ? { range: { from: dates[0], to: dates[dates.length - 1] } } : {}),
  };
}

/**
 * The bank's accounts joined to the ones Annum has: the same bank account is updated; an
 * account that came from files (same kind, same last 4 digits) becomes the connected one and
 * keeps its history and name; anything else is new.
 */
export function mergeBankAccounts(
  existing: readonly Account[],
  incoming: readonly Omit<Account, 'id'>[],
  transactions: readonly Transaction[],
  newId: () => string,
): Account[] {
  const out = [...existing];
  for (const a of incoming) {
    const same = out.findIndex((x) => !!x.plaidAccountId && x.plaidAccountId === a.plaidAccountId);
    if (same >= 0) {
      out[same] = { ...out[same], ...a, id: out[same].id };
      continue;
    }
    const imported = out.findIndex(
      (x) => x.source === 'import' && x.type === a.type && !!a.last4 && x.last4 === a.last4,
    );
    if (imported >= 0) {
      const was = out[imported];
      const through = transactions
        .filter((t) => t.accountId === was.id)
        .reduce<ISODate | undefined>((max, t) => (!max || t.date > max ? t.date : max), undefined);
      out[imported] = {
        ...was,
        ...a,
        id: was.id,
        name: was.name,
        ...(through ? { importedThrough: through } : {}),
      };
      continue;
    }
    out.push({ ...a, id: newId() });
  }
  return out;
}
