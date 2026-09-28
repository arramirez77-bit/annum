/**
 * Plaid's answers → Annum's shapes. Pure and unit-tested. Plaid sends dollars as decimals with
 * money out positive; Annum uses integer cents with money out negative (docs/03).
 */
import {
  tidyMerchant,
  type Account,
  type BankTransaction,
  type Cents,
  type ISODate,
} from '@/domain';

/**
 * Why a sync couldn't finish; each maps to a calm state (Reconnect, or try again later).
 * Offline and a replaced access key are Worker problems (client.ts), not Plaid's.
 */
export type SyncProblem = 'needs-reauth' | 'provider-unavailable' | 'unknown';

/* ---------- the parts of Plaid's responses Annum reads ---------- */

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code?: string | null };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  iso_currency_code?: string | null;
  personal_finance_category?: { primary: string; detailed: string } | null;
}

export interface PlaidSyncPage {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
  /** NOT_READY: a new connection's first pull hasn't finished (empty page, but a cursor). */
  transactions_update_status?: string;
}

export interface PlaidCreditLiability {
  account_id: string | null;
  last_statement_balance: number | null;
  last_statement_issue_date: string | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
}

export interface PlaidError {
  error_type: string;
  error_code: string;
  /** Plaid's explanation (which field, which rule). Never contains tokens. */
  error_message?: string;
}

/* ---------- mapping ---------- */

export const toCents = (dollars: number): Cents => Math.round(dollars * 100);

/** Plaid's account type → Annum's, or null for kinds Annum doesn't track. */
export function accountType(type: string, subtype?: string | null): Account['type'] | null {
  switch (type) {
    case 'depository':
      return ['savings', 'money market', 'cd', 'hsa'].includes(subtype ?? '')
        ? 'savings'
        : 'checking';
    case 'credit':
      return 'card';
    case 'investment':
    case 'brokerage':
      return 'brokerage';
    case 'loan':
      return 'loan';
    default:
      return null;
  }
}

/**
 * A card statement, from Liabilities. Paid already (a payment on or after the statement date
 * covered it) → 0, which Annum never subtracts (decision M1-5).
 */
export function statementFrom(l: PlaidCreditLiability | undefined): {
  statementBalance?: Cents;
  statementDue?: ISODate | null;
} {
  if (!l || l.last_statement_balance === null) return {};
  const owed = toCents(l.last_statement_balance);
  const paid =
    !!l.last_payment_date &&
    !!l.last_statement_issue_date &&
    l.last_payment_date >= l.last_statement_issue_date &&
    toCents(l.last_payment_amount ?? 0) >= owed;
  return { statementBalance: paid ? 0 : Math.max(0, owed), statementDue: l.next_payment_due_date };
}

/**
 * The account as Annum keeps it. Checking uses what the bank says is available (it already
 * counts pending charges, which Annum doesn't subtract again); others use the current balance.
 * Cards and loans: the amount owed, positive, as Plaid reports it.
 */
export function mapAccount(
  p: PlaidAccount,
  itemId: string,
  syncedAt: string,
  liability?: PlaidCreditLiability,
): Omit<Account, 'id'> | null {
  const type = accountType(p.type, p.subtype);
  if (!type) return null;
  const dollars =
    type === 'checking'
      ? (p.balances.available ?? p.balances.current)
      : (p.balances.current ?? p.balances.available);
  return {
    name: tidyMerchant(p.name),
    type,
    balance: toCents(dollars ?? 0),
    ...(type === 'card' ? statementFrom(liability) : {}),
    lastSynced: syncedAt,
    ...(p.mask ? { last4: p.mask } : {}),
    source: 'plaid',
    plaidAccountId: p.account_id,
    itemId,
    status: 'ok',
  };
}

/** Plaid's personal-finance category → Annum's, when there's a clear match. */
export function categoryHint(
  pfc: PlaidTransaction['personal_finance_category'],
): string | undefined {
  if (!pfc) return undefined;
  const { primary, detailed } = pfc;
  if (detailed === 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT') return 'Card payment';
  if (detailed === 'FOOD_AND_DRINK_GROCERIES') return 'Groceries';
  if (detailed === 'TRANSPORTATION_GAS') return 'Gas';
  if (detailed === 'GENERAL_SERVICES_INSURANCE') return 'Bills';
  switch (primary) {
    case 'INCOME':
      return 'Income';
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return 'Transfer';
    case 'LOAN_PAYMENTS':
    case 'RENT_AND_UTILITIES':
      return 'Bills';
    case 'FOOD_AND_DRINK':
      return 'Dining';
    case 'TRANSPORTATION':
    case 'TRAVEL':
      return 'Travel';
    case 'MEDICAL':
      return 'Health';
    case 'GENERAL_MERCHANDISE':
      return 'Shopping';
    default:
      return undefined;
  }
}

export function mapTransaction(p: PlaidTransaction): BankTransaction {
  const hint = categoryHint(p.personal_finance_category);
  return {
    externalId: p.transaction_id,
    accountExternalId: p.account_id,
    date: p.date,
    merchant: p.merchant_name || p.name,
    amount: -toCents(p.amount),
    pending: p.pending,
    ...(p.pending_transaction_id ? { replaces: p.pending_transaction_id } : {}),
    ...(hint ? { categoryHint: hint } : {}),
  };
}

/**
 * What a Plaid problem means for the person. Signing in again is the only one they act on
 * (Reconnect); the rest wait and try later.
 */
export function problemOf(e: PlaidError): SyncProblem {
  if (
    [
      'ITEM_LOGIN_REQUIRED',
      'PENDING_EXPIRATION',
      'PENDING_DISCONNECT',
      'INVALID_CREDENTIALS',
      'INVALID_MFA',
      'USER_PERMISSION_REVOKED',
      'ACCESS_NOT_GRANTED',
    ].includes(e.error_code)
  ) {
    return 'needs-reauth';
  }
  if (
    e.error_type === 'INSTITUTION_ERROR' ||
    e.error_type === 'RATE_LIMIT_EXCEEDED' ||
    e.error_code === 'PRODUCT_NOT_READY' ||
    e.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'
  ) {
    return 'provider-unavailable';
  }
  return 'unknown';
}
