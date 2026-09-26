/**
 * Bank sync, provider-neutral (Andy, 2026-09-25: provider undecided — Teller, Plaid, SimpleFIN,
 * or file import only). Screens and the domain never see a provider; the data layer maps whatever
 * a provider returns into these shapes, then into domain Accounts and Transactions.
 */
import type { Account, Cents, ISODate } from '@/domain';

export type ProviderId = 'manual' | 'import' | 'teller' | 'plaid' | 'simplefin';

export interface ProviderAccount {
  /** The provider's stable id, used to dedupe across syncs. */
  externalId: string;
  name: string;
  type: Account['type'];
  /** Cards and loans: amount owed, positive. */
  balance: Cents;
  statementBalance?: Cents;
  statementDue?: ISODate;
}

export interface ProviderTransaction {
  externalId: string;
  accountExternalId: string;
  date: ISODate;
  merchant: string;
  /** Negative = money out. */
  amount: Cents;
  pending: boolean;
}

/** Why a sync couldn't finish — each maps to a calm state on screen (Reconnect, Offline, E4). */
export type SyncProblem = 'needs-reauth' | 'offline' | 'provider-unavailable' | 'unknown';

export class SyncError extends Error {
  constructor(
    readonly problem: SyncProblem,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface SyncProvider {
  id: ProviderId;
  /** Shown in Settings → Connected banks. */
  label: string;
  /** False for manual entry and file import: they work offline. */
  needsNetwork: boolean;
  listAccounts(): Promise<ProviderAccount[]>;
  listTransactions(accountExternalId: string, since: ISODate): Promise<ProviderTransaction[]>;
  /** Revoke access at the provider and forget local credentials. */
  disconnect(): Promise<void>;
}

/** Manual accounts (S10): balances are typed in, so there is nothing to fetch. */
export const manualProvider: SyncProvider = {
  id: 'manual',
  label: 'Entered by hand',
  needsNetwork: false,
  listAccounts: async () => [],
  listTransactions: async () => [],
  disconnect: async () => undefined,
};

/** No bank-sync provider is chosen yet; see SPIKES.md "Bank sync". */
export const bankProvider: SyncProvider | null = null;
