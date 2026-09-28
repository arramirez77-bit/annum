/**
 * Talking to the Annum Worker (docs/02 "The Worker"), the app's only network calls besides
 * Plaid Link itself. Every request carries this phone's access key; tokens travel only in
 * request bodies. Nothing here logs, and errors carry a problem name, never a response body.
 */
import type { BankChanges } from '@/domain';

import {
  mapTransaction,
  problemOf,
  type PlaidAccount,
  type PlaidCreditLiability,
  type PlaidError,
  type PlaidSyncPage,
} from './map';

export type PlaidEnv = 'sandbox' | 'production';

/**
 * not-paired: this phone hasn't scanned a code · key-refused: the key was replaced (a lost
 * phone) · offline: no network · limit-reached: all 10 connections used · environment-off:
 * real banks aren't switched on at the Worker yet · slow-down: too many requests ·
 * unavailable: the Worker or Plaid is having trouble · plaid: Plaid answered with a problem.
 */
export type WorkerProblem =
  | 'not-paired'
  | 'key-refused'
  | 'offline'
  | 'limit-reached'
  | 'environment-off'
  | 'slow-down'
  | 'unavailable'
  | 'plaid';

export class WorkerError extends Error {
  constructor(
    readonly problem: WorkerProblem,
    readonly plaid?: PlaidError,
  ) {
    super(plaid ? `${problem}: ${plaid.error_code}` : problem);
    this.name = 'WorkerError';
  }
}

export interface WorkerStatus {
  used: number;
  limit: number;
  left: number;
  sandbox: boolean;
  production: boolean;
}

export interface SyncResult extends BankChanges {
  cursor: string;
  /** Plaid hasn't finished pulling a new connection's transactions: ask again soon. */
  notReady: boolean;
  /** Recent transactions are in, older history is still coming (INITIAL_UPDATE_COMPLETE). */
  historyPending: boolean;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface WorkerClientOptions {
  baseUrl: string;
  getKey: () => Promise<string | null>;
  /**
   * This build's Plaid environment, sent with the status check: the Worker answers a release
   * build holding the development key (Sandbox only) with "scan the code".
   */
  env?: PlaidEnv;
  fetch?: Fetch;
  /** Give up on a request after this long (the phone may be on a weak signal). */
  timeoutMs?: number;
}

const PROBLEMS: Record<string, WorkerProblem> = {
  'key-refused': 'key-refused',
  'limit-reached': 'limit-reached',
  'environment-off': 'environment-off',
  'slow-down': 'slow-down',
};

export function workerClient(options: WorkerClientOptions) {
  const doFetch: Fetch = options.fetch ?? ((url, init) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? 30_000;
  const envBody = options.env ? { env: options.env } : {};

  /**
   * `key`: a scanned key being checked before it's saved (otherwise the saved one). `timeoutMs`:
   * longer for the token exchange, whose answer can't be asked for twice.
   */
  async function call<T>(
    route: string,
    body: Record<string, unknown>,
    over: { key?: string; timeoutMs?: number } = {},
  ): Promise<T> {
    const key = over.key ?? (await options.getKey());
    if (!key) throw new WorkerError('not-paired');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), over.timeoutMs ?? timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${options.baseUrl}/v1/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-annum-key': key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new WorkerError('offline');
    } finally {
      clearTimeout(timer);
    }
    let answer: unknown;
    try {
      answer = await res.json();
    } catch {
      throw new WorkerError('unavailable');
    }
    if (res.ok) return answer as T;
    const a = (answer ?? {}) as {
      problem?: string;
      error_code?: string;
      error_type?: string;
      error_message?: string;
    };
    if (a.error_code && a.error_type) {
      throw new WorkerError('plaid', {
        error_code: a.error_code,
        error_type: a.error_type,
        ...(a.error_message ? { error_message: a.error_message } : {}),
      });
    }
    throw new WorkerError((a.problem && PROBLEMS[a.problem]) || 'unavailable');
  }

  return {
    status: () => call<WorkerStatus>('status', envBody),

    /** The count, asked with a scanned key that isn't saved yet: does the Worker accept it? */
    statusWith: (key: string) => call<WorkerStatus>('status', envBody, { key }),

    /** A link token for a new connection. */
    linkToken: (env: PlaidEnv, clientUserId: string) =>
      call<{ link_token: string }>('link-token', { env, client_user_id: clientUserId }).then(
        (r) => r.link_token,
      ),

    /** A link token that repairs an existing connection (update mode): never uses a new one. */
    repairToken: (accessToken: string, clientUserId: string) =>
      call<{ link_token: string }>('link-token', {
        access_token: accessToken,
        client_user_id: clientUserId,
      }).then((r) => r.link_token),

    exchange: (publicToken: string) =>
      call<{ access_token: string; item_id: string; used: number }>(
        'exchange',
        { public_token: publicToken },
        // Plaid only exchanges a public token once: wait longer rather than lose the answer.
        { timeoutMs: Math.max(timeoutMs, 90_000) },
      ),

    /** Development builds: a Sandbox connection without Link's screens (tests). */
    sandboxConnect: () =>
      call<{ public_token: string }>('sandbox/connect', {}).then((r) => r.public_token),

    /** Development builds: make a Sandbox connection ask to sign in again (tests Reconnect). */
    sandboxResetLogin: (accessToken: string) =>
      call<unknown>('sandbox/item/reset_login', { access_token: accessToken }),

    accounts: (accessToken: string, live = false) =>
      call<{ accounts: PlaidAccount[] }>(live ? 'accounts/balance/get' : 'accounts/get', {
        access_token: accessToken,
      }).then((r) => r.accounts),

    /** Card statements. A bank without them (or without cards) simply has none. */
    liabilities: async (accessToken: string): Promise<PlaidCreditLiability[]> => {
      try {
        const r = await call<{ liabilities: { credit: PlaidCreditLiability[] | null } }>(
          'liabilities/get',
          { access_token: accessToken },
        );
        return r.liabilities.credit ?? [];
      } catch (e) {
        // Card statements are extra: whatever Plaid says about them (not supported, not ready,
        // more consent needed, busy) skips them this time instead of stopping the sync. Signing
        // in again still goes through, so Reconnect shows.
        if (e instanceof WorkerError && e.plaid && problemOf(e.plaid) !== 'needs-reauth') {
          return [];
        }
        throw e;
      }
    },

    /**
     * Everything new since `cursor` (null: the whole history). Pages until Plaid says there's
     * no more; if the data changes mid-way, starts again from the same cursor (Plaid's rule).
     */
    sync: async (accessToken: string, cursor: string | null): Promise<SyncResult> => {
      for (let attempt = 0; ; attempt++) {
        const added: PlaidSyncPage['added'] = [];
        const modified: PlaidSyncPage['modified'] = [];
        const removed: string[] = [];
        let next = cursor;
        let status: string | undefined;
        try {
          for (;;) {
            const page = await call<PlaidSyncPage>('transactions/sync', {
              access_token: accessToken,
              ...(next ? { cursor: next } : {}),
              count: 500,
            });
            added.push(...page.added);
            modified.push(...page.modified);
            removed.push(...page.removed.map((r) => r.transaction_id));
            next = page.next_cursor;
            status = page.transactions_update_status;
            if (!page.has_more) break;
          }
        } catch (e) {
          const restart =
            e instanceof WorkerError &&
            e.plaid?.error_code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION';
          if (restart && attempt < 3) continue;
          throw e;
        }
        return {
          added: added.map(mapTransaction),
          modified: modified.map(mapTransaction),
          removed,
          cursor: next ?? '',
          notReady: status === 'NOT_READY',
          historyPending: status === 'INITIAL_UPDATE_COMPLETE',
        };
      }
    },

    /** Only when the person chooses "Also end my bank connections at Plaid". */
    removeItem: (accessToken: string) =>
      call<unknown>('item/remove', { access_token: accessToken }),
  };
}

export type WorkerClient = ReturnType<typeof workerClient>;
