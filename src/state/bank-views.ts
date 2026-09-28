/**
 * Words for bank connections (M7): the "uses 1 of your 10" confirmation, calm problem states,
 * Settings rows, and Today's notes. Pure, unit-tested. Voice: docs/01 (never "error" or
 * "failed"; say what happened and what to do next).
 */
import type { WorkerProblem, WorkerStatus } from '@/data/plaid/client';
import type { BankConnection } from '@/data/repo';
import { formatShortDate, localISODate } from '@/domain';

import type { Access } from './bank';

export interface Message {
  title: string;
  body: string;
  /** What the primary button does. */
  action?: 'connect' | 'pair' | 'import' | 'retry' | 'done';
}

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "7:02 AM" today, else "Sep 20". */
export function syncedLabel(localDateTime: string, now: Date): string {
  const day = localDateTime.slice(0, 10);
  return day === localISODate(now) ? time.format(new Date(localDateTime)) : formatShortDate(day);
}

const ALL_USED: Message = {
  title: 'All 10 bank connections are used',
  body: 'Plaid’s free plan allows 10 for life, shared by both phones, and ended ones don’t come back. Import a file from your bank instead; it works the same way.',
  action: 'import',
};

/** Before Plaid Link opens: what a new connection costs. `sandbox`: development builds. */
export function confirmMessage(status: WorkerStatus, sandbox: boolean): Message {
  if (sandbox) {
    return {
      title: 'Connect a test bank',
      body: `Development build: this opens Plaid’s test banks and doesn’t use any of your 10 bank connections (${status.left} left for both phones).`,
      action: 'connect',
    };
  }
  if (status.left <= 0) return ALL_USED;
  return {
    title: 'Connect a bank',
    body: `This uses 1 of your 10 bank connections. ${status.left} left for both phones. If it ever needs you to sign in again, Annum repairs it without using another.`,
    action: 'connect',
  };
}

export const repairMessage = (institution: string): Message => ({
  title: `Sign in to ${institution} again`,
  body: 'This repairs your connection in place. It doesn’t use a new one.',
  action: 'connect',
});

/** E4: Link was closed or the bank didn't connect. */
export const DIDNT_CONNECT: Message = {
  title: 'That bank didn’t connect',
  body: 'Nothing was saved and no connection was used.',
  action: 'retry',
};

/** S8: "Also end my bank connections at Plaid" didn't reach every one, so nothing was deleted. */
export const notEndedNote = (n: number): string =>
  `Plaid didn’t end ${n === 1 ? 'one of your bank connections' : `${n} of your bank connections`}, so nothing was deleted. Try again in a moment, or turn off “Also end my bank connections at Plaid” to delete anyway.`;

export const finishLaterMessage = (institution: string): Message => ({
  title: `${institution} is almost connected`,
  body: 'Annum will finish bringing it in as soon as this phone is back online. It won’t use another connection.',
  action: 'done',
});

export function connectedMessage(institution: string, transactions: number): Message {
  return {
    title: `${institution} is connected`,
    body:
      transactions > 0
        ? `Annum brought in ${transactions.toLocaleString('en-US')} transactions.`
        : 'Your transactions are on their way and will appear in a minute or two.',
    action: 'done',
  };
}

export const repairedMessage = (institution: string): Message => ({
  title: `${institution} is up to date again`,
  body: 'Your connection was repaired. No new connection was used.',
  action: 'done',
});

/** Problems before Link opens. Nothing is used in any of them. */
export function problemMessage(problem: WorkerProblem | 'unknown'): Message {
  switch (problem) {
    case 'not-paired':
      return {
        title: 'Pair this phone first',
        body: 'Annum reaches banks through a small private service, and this phone needs its code. On the laptop, run “npm run worker:rotate-key” and scan the code with this iPhone’s Camera.',
        action: 'pair',
      };
    case 'key-refused':
      return {
        title: 'Scan the new code from your laptop',
        body: 'The access code was replaced. Scan the new one with this iPhone’s Camera. Your bank connections stay as they are.',
        action: 'pair',
      };
    case 'offline':
      return {
        title: 'You’re offline',
        body: 'Connecting a bank needs the internet. Nothing was used.',
        action: 'retry',
      };
    case 'limit-reached':
      return ALL_USED;
    case 'environment-off':
      return {
        title: 'Real banks aren’t switched on yet',
        body: 'Annum can’t connect real banks until they’re turned on. Import a file from your bank for now.',
        action: 'import',
      };
    case 'slow-down':
      return {
        title: 'One moment',
        body: 'Too many requests at once. Try again in a minute. Nothing was used.',
        action: 'retry',
      };
    default:
      return {
        title: 'Plaid isn’t answering right now',
        body: 'Try again in a few minutes. Nothing was saved and no connection was used.',
        action: 'retry',
      };
  }
}

/** Settings → Accounts: "7 of 10 left". */
export const countLabel = (count: WorkerStatus | null): string =>
  count ? `${count.left} of ${count.limit} left` : 'Not checked yet';

export interface ConnectionRow {
  id: string;
  title: string;
  subtitle: string;
  reconnect: boolean;
}

export function connectionRows(connections: readonly BankConnection[], now: Date): ConnectionRow[] {
  return connections.map((c) => ({
    id: c.itemId,
    title: c.env === 'sandbox' ? `${c.institution} (test)` : c.institution,
    subtitle:
      c.status === 'needs-reauth'
        ? 'Needs you to sign in again'
        : c.status === 'exchanging'
          ? 'Finishing connecting…'
          : c.lastSynced
            ? `Updated ${syncedLabel(c.lastSynced, now)}`
            : 'Getting your transactions…',
    reconnect: c.status === 'needs-reauth',
  }));
}

/** Today's bank note (heads-up), if any: a replaced key, or a bank asking to sign in again. */
export function todayBankNote(
  access: Access,
  connections: readonly BankConnection[],
): string | undefined {
  const live = connections.filter((c) => c.status !== 'exchanging');
  if (!live.length) return undefined;
  if (access === 'key-refused') {
    return 'Scan the new code from your laptop to keep your banks updating. Everything on this phone stays as it is.';
  }
  const broken = live.find((c) => c.status === 'needs-reauth');
  if (broken) {
    return `${broken.institution} needs you to sign in again. Reconnect it in Settings; it won’t use a new connection.`;
  }
  return undefined;
}

/** Today's footnote while syncing or offline (numbers keep their last value). */
export function todayBankFootnote(
  syncing: boolean,
  offline: boolean,
  connections: readonly BankConnection[],
): string | undefined {
  if (!connections.length) return undefined;
  if (syncing) return 'Updating…';
  if (offline) return 'Offline — showing what’s on this phone.';
  return undefined;
}
