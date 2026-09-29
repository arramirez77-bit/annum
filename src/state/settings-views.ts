/** S3 Settings: the values each row shows. Pure, unit-tested. */
import type { BankConnection, Prefs } from '@/data/repo';
import {
  formatDollars,
  formatShortDate,
  proposedBills,
  taxApplies,
  type Account,
  type AppData,
  type Cadence,
} from '@/domain';

import { syncedLabel } from './bank-views';

export const CADENCE_WORD: Record<Cadence, string> = {
  weekly: 'weekly',
  biweekly: 'every 2 weeks',
  monthly: 'monthly',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sun 10 AM", "Sun 9:30 AM" (Figma S3). */
export function weeklyReminderLabel(weekly: Prefs['reminders']['weekly']): string {
  if (!weekly) return 'Off';
  const at = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    ...(weekly.minute ? { minute: '2-digit' } : {}),
  }).format(new Date(2026, 0, 4, weekly.hour, weekly.minute));
  return `${WEEKDAYS[weekly.weekday]} ${at}`;
}

/** "5 months" from the target and monthly spending (rounded to a whole month). */
export const targetMonths = (data: AppData): number =>
  data.settings.monthlySpend > 0
    ? Math.round(data.settings.runwayTarget / data.settings.monthlySpend)
    : 0;

export function buildSettingsView(data: AppData, prefs: Prefs) {
  const s = data.settings;
  const months = targetMonths(data);
  return {
    showTax: taxApplies(data),
    /** Tax module toggle only makes sense with freelance income. */
    taxToggle: s.incomeType !== 'salary',
    numbers: {
      tax: `${Math.round(s.taxRate * 100)}%`,
      runway:
        s.runwayTarget > 0
          ? `${formatDollars(s.runwayTarget)}${months ? ` · ${months} months` : ''}`
          : 'Not set',
      habit: s.habitTransfer.amount
        ? `${formatDollars(s.habitTransfer.amount)} ${CADENCE_WORD[s.habitTransfer.cadence]}`
        : 'Not set',
      spend: s.monthlySpend > 0 ? `About ${formatDollars(s.monthlySpend)}` : 'Not set',
      pay: s.paySchedule
        ? `${formatDollars(s.paySchedule.amount)} ${CADENCE_WORD[s.paySchedule.cadence]}`
        : 'Not set',
    },
    /** Salary and Both have a paycheck to edit. */
    showPay: s.incomeType !== 'freelance',
    /** Bills found in imported files, waiting for a yes or no. */
    bills: ((n) => (n ? `${n} to look at` : undefined))(proposedBills(data.bills).length),
    accountCount: `${data.accounts.length} ${data.accounts.length === 1 ? 'account' : 'accounts'}`,
    weekly: weeklyReminderLabel(prefs.reminders.weekly),
  };
}

// S3 Accounts, grouped by where each balance comes from (Figma 117:1728) -----------------------

export interface SourceAccountRow {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  /** Bank and file accounts open their Transactions; accounts entered by hand open S10. */
  opens: 'transactions' | 'balance';
}

export interface AccountSource {
  key: string;
  kind: 'bank' | 'files' | 'hand';
  title: string;
  subtitle: string;
  /** A bank that asks to sign in again: its Plaid item, for Reconnect (update mode). */
  reconnect?: string;
  accounts: SourceAccountRow[];
}

function sourceAccountRow(a: Account, data: AppData): SourceAccountRow {
  const byHand = a.source === 'manual';
  const empty = byHand && a.balance === 0;
  const subtitle = empty
    ? 'Tap to add balance'
    : a.type === 'card'
      ? a.statementDue
        ? `Credit card · due ${formatShortDate(a.statementDue)}`
        : 'Credit card'
      : a.type === 'savings' && !data.savingsUnsplit
        ? 'Split into buckets'
        : byHand && a.enteredOn
          ? `Updated ${formatShortDate(a.enteredOn)}`
          : a.source === 'import' && a.lastSynced
            ? `Imported ${formatShortDate(a.lastSynced.slice(0, 10))}`
            : undefined;
  return {
    id: a.id,
    title: a.name,
    subtitle,
    value: empty ? undefined : formatDollars(a.balance),
    opens: byHand ? 'balance' : 'transactions',
  };
}

const syncedSubtitle = (lastSynced: string | undefined, now: Date) =>
  lastSynced
    ? `Connected · synced ${syncedLabel(lastSynced, now)}`
    : 'Connected · getting your transactions…';

export function accountSources(
  data: AppData,
  connections: readonly BankConnection[],
  now: Date,
): AccountSource[] {
  const rows = (list: Account[]) => list.map((a) => sourceAccountRow(a, data));
  const sources: AccountSource[] = connections.map((c) => ({
    key: c.itemId,
    kind: 'bank',
    title: c.env === 'sandbox' ? `${c.institution} (test)` : c.institution,
    subtitle:
      c.status === 'needs-reauth'
        ? 'Needs you to sign in again'
        : c.status === 'exchanging'
          ? 'Finishing connecting…'
          : syncedSubtitle(c.lastSynced, now),
    ...(c.status === 'needs-reauth' ? { reconnect: c.itemId } : {}),
    accounts: rows(data.accounts.filter((a) => a.source === 'plaid' && a.itemId === c.itemId)),
  }));
  const known = new Set(connections.map((c) => c.itemId));
  const loose = data.accounts.filter(
    (a) => a.source === 'plaid' && !(a.itemId && known.has(a.itemId)),
  );
  if (loose.length) {
    sources.push({
      key: 'bank',
      kind: 'bank',
      title: 'Bank',
      subtitle: syncedSubtitle(loose[0].lastSynced, now),
      accounts: rows(loose),
    });
  }
  const demo = data.accounts.filter((a) => a.source === 'demo');
  if (demo.length) {
    sources.push({
      key: 'demo',
      kind: 'bank',
      title: 'Sample bank',
      subtitle: syncedSubtitle(demo[0].lastSynced, now),
      accounts: rows(demo),
    });
  }
  const files = data.accounts.filter((a) => a.source === 'import');
  if (files.length) {
    sources.push({
      key: 'files',
      kind: 'files',
      title: 'From files',
      subtitle: 'Updated when you import a file',
      accounts: rows(files),
    });
  }
  const hand = data.accounts.filter((a) => a.source === 'manual');
  if (hand.length) {
    sources.push({
      key: 'hand',
      kind: 'hand',
      title: 'Entered by hand',
      subtitle: 'You update these balances',
      accounts: rows(hand),
    });
  }
  return sources;
}

// S8 Delete everything (Figma 71:1066) ---------------------------------------------------------

const count = new Intl.NumberFormat('en-US');

/** What goes, with counts, and the line under "End my bank logins at Plaid too". */
export function buildDeleteView(data: AppData, banks: number, endAtPlaid: boolean) {
  const taxes = taxApplies(data);
  const tagged = data.transactions.filter((t) => t.tax).length;
  return {
    rows: [
      {
        title: 'Accounts and balances',
        subtitle: banks
          ? endAtPlaid
            ? 'Bank logins end at Plaid too'
            : 'Bank logins stay open at Plaid'
          : undefined,
        value: count.format(data.accounts.length),
      },
      {
        title: 'Transactions and tags',
        subtitle:
          taxes && tagged
            ? `Including ${count.format(tagged)} work ${tagged === 1 ? 'expense' : 'expenses'}`
            : undefined,
        value: count.format(data.transactions.length),
      },
      {
        title: 'Buckets and settings',
        subtitle: taxes
          ? 'Tax percentage, Runway target, and your habits'
          : 'Runway target and your habits',
        value: 'All',
      },
    ],
    bankLine: endAtPlaid
      ? 'Ended logins still count against your 10, and a backup can’t bring them back.'
      : 'Your bank logins stay open at Plaid, so a backup can bring them back without using any of your 10.',
  };
}
