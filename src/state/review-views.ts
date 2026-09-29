/**
 * View models for the Weekly Review (04–08), the deposit split (O6, 09), Transactions (S1)
 * and Taxes (S2). Pure; every sentence is unit-tested. docs/05.
 */
import {
  availableToSpend,
  normalizeMerchant,
  billsDueNext30,
  BUCKET_KEYS,
  CATEGORIES,
  formatCents,
  formatCompactThousands,
  formatDollarChange,
  formatDollars,
  formatMonths,
  formatMonthsChange,
  formatShortDate,
  formatDayLabel,
  formatLedgerCents,
  formatWeekdayDate,
  localISODate,
  nextReviewDate,
  notableCategory,
  proposeSplit,
  runwayMonths,
  savingsBalance,
  spendBar,
  splitTotal,
  taxApplies,
  taxCategoryOf,
  taxSummary,
  TAX_CATEGORIES,
  toTag,
  unsplitPreview,
  weekReport,
  weeklyChanges,
  type CategoryRule,
  weeklyTransfer,
  type AppData,
  type BucketKey,
  type Cents,
  type Split,
  type Transaction,
  type Account,
} from '@/domain';

import type { PendingTransfer } from './store';
import { syncedLabel } from './bank-views';
import { BUCKET_NAMES } from './views';

export type ReviewStepId = 'balances' | 'tag' | 'changes' | 'habit' | 'move' | 'done';

/** The steps this review has. The habit step (07b) only appears on the first review. */
export const reviewSteps = (data: AppData): ReviewStepId[] =>
  data.settings.isEstimate
    ? ['balances', 'tag', 'changes', 'habit', 'move', 'done']
    : ['balances', 'tag', 'changes', 'move', 'done'];

const listNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// 04 Balances ------------------------------------------------------------------

/** "Contoso Card" / "Woodgrove checking" → the bank's short name ("Contoso", "Woodgrove"). */
const shortBank = (name: string) => name.replace(/\s+(card|checking|savings)$/i, '');
const clockTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** Each account's line on 04 (Figma 59:167). */
function balanceLine(a: Account, data: AppData, now: Date): string {
  if (a.source === 'manual') {
    return a.enteredOn
      ? `Entered by hand · updated ${formatShortDate(a.enteredOn)}`
      : 'Entered by hand';
  }
  if (a.source === 'import') {
    return a.lastSynced ? `Imported ${formatShortDate(a.lastSynced.slice(0, 10))}` : 'From a file';
  }
  if (a.type === 'card' && a.statementDue)
    return `Statement due ${formatShortDate(a.statementDue)}`;
  const synced = a.lastSynced ? `Synced ${syncedLabel(a.lastSynced, now)}` : 'Not synced yet';
  return a.type === 'savings' && !data.savingsUnsplit ? `${synced} · split into buckets` : synced;
}

export function buildBalancesView(data: AppData, now: Date) {
  const rows = data.accounts.map((a) => ({
    id: a.id,
    title: a.name,
    subtitle: balanceLine(a, data, now),
    editable: a.source === 'manual',
    value: formatDollars(a.balance),
  }));
  const manual = data.accounts.filter((a) => a.source === 'manual').map((a) => a.name);
  const imported = data.accounts.filter((a) => a.source === 'import').map((a) => a.name);
  const last = data.accounts
    .filter((a) => (a.source === 'plaid' || a.source === 'demo') && a.lastSynced)
    .map((a) => a.lastSynced!)
    .sort()
    .pop();
  const lastDay = last?.slice(0, 10);
  const hour = last ? new Date(last).getHours() : 0;
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const when = !last
    ? undefined
    : lastDay === localISODate(now)
      ? `this ${part} at ${clockTime.format(new Date(last)).replace(/\s?[AP]M$/i, '')}`
      : `on ${formatShortDate(lastDay!)}`;
  return {
    title: 'Check your balances',
    subtitle: when
      ? `Synced ${when}. Anything that didn’t connect is marked.`
      : 'Update any balance that changed.',
    rows,
    importNote: imported.length
      ? `${listNames(imported)} ${imported.length === 1 ? 'comes' : 'come'} from files. Import this week’s download first, so the review sees every purchase.`
      : undefined,
    manualNote: manual.length
      ? manual.length === 1
        ? `${manual[0]} is entered by hand. Tap it to update it if the balance changed.`
        : `${listNames(manual)} are entered by hand. Tap one to update it if the balance changed.`
      : undefined,
    primary: 'Looks right',
  };
}

// 05 Tag -----------------------------------------------------------------------

const weekdayShort = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Two category chips per card: the suggestion, then "Other". (Decision: PROGRESS.md.) */
export const categoryChoices = (t: Transaction): string[] => {
  const suggested = t.suggestedCategory ?? t.category ?? 'Other';
  return suggested === 'Other' ? ['Other'] : [suggested, 'Other'];
};

export function buildTagView(data: AppData) {
  const accounts = new Map(data.accounts.map((a) => [a.id, shortBank(a.name)]));
  const items = toTag(data).map((t) => ({
    id: t.id,
    merchant: t.merchant,
    dateLabel: weekdayShort.format(new Date(`${t.date}T00:00:00Z`)).replace(',', ''),
    accountName: accounts.get(t.accountId) ?? '',
    amount: t.amount,
    suggestions: categoryChoices(t),
    selected: t.category ?? t.suggestedCategory,
    tax: t.tax,
  }));
  const n = items.length;
  const taxes = taxApplies(data);
  return {
    title: 'What were these?',
    subtitle:
      n === 0
        ? 'Nothing new this week. Every transaction already has a category.'
        : `${n} new this week. We guessed a category for each one. Fix any that are wrong${taxes ? ', and tap Work expense for anything you bought for work' : ''}.`,
    items,
    showTax: taxes,
    primary: 'Looks right',
  };
}

// 06 What changed --------------------------------------------------------------

export function buildChangesView(data: AppData) {
  const ats = availableToSpend(data);
  const change = weeklyChanges(data);
  const cards: { bucket: BucketKey; title: string; value: string; line: string }[] = [
    {
      bucket: 'free',
      title: 'Free to spend',
      value: formatDollars(ats.display),
      line: change
        ? `${formatDollarChange(change.freeToSpend)} this week`
        : `About ${formatDollars(ats.perDay)} a day`,
    },
    {
      bucket: 'runway',
      title: 'Runway',
      value: `${formatMonths(runwayMonths(data))} months`,
      line: change
        ? `${formatMonthsChange(change.runwayMonths)} months`
        : `${formatCompactThousands(data.settings.runwayTarget)} target`,
    },
  ];
  if (taxApplies(data)) {
    cards.push({
      bucket: 'tax',
      title: 'Taxes',
      value: formatDollars(data.buckets.tax),
      line: data.taxYear
        ? `On track for ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
        : 'Set aside for taxes',
    });
  }
  const notable = notableCategory(weekReport(data));
  const diff = notable ? notable.amount - notable.average : 0;
  return {
    title: 'Your week',
    subtitle: 'What changed since last Sunday.',
    cards,
    note:
      notable && notable.label !== 'about usual' && diff !== 0
        ? `You spent ${formatDollars(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} on ${notable.category.toLowerCase()} than your 4-week average.${diff > 0 ? ' That came out of Free, not savings, so there’s nothing to fix.' : ''}`
        : undefined,
    primary: 'Next',
  };
}

// 07b Habit (first review only) -------------------------------------------------

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "the Contoso statement and two bills" — what lands this week (07b). */
function whatLands(due: readonly { kind: 'bill' | 'statement'; name: string }[]): string {
  const statements = due
    .filter((o) => o.kind === 'statement')
    .map((o) => `the ${shortBank(o.name)} statement`);
  const bills = due.filter((o) => o.kind === 'bill').length;
  const billWords = bills
    ? `${NUMBER_WORDS[bills] ?? bills} ${bills === 1 ? 'bill' : 'bills'}`
    : undefined;
  return listNames([...statements, ...(billWords ? [billWords] : [])]);
}

export function buildHabitView(data: AppData) {
  const t = weeklyTransfer(data);
  const lands = whatLands(t.due);
  return {
    title: 'How much do you usually move?',
    subtitle: 'First review only. After this, Annum starts from your habit and suggests changes.',
    helper: 'From savings to checking.',
    note: lands
      ? `Next, we’ll check it against this week: ${lands} ${t.due.length === 1 ? 'lands' : 'land'}, so you’ll likely need about ${formatDollars(t.total)}.`
      : `Next, we’ll check it against this week. Nothing big is due, so you’ll likely need about ${formatDollars(t.total)}.`,
    primary: 'Continue',
  };
}

// 07 Move money ----------------------------------------------------------------

/** Bank websites Annum can open for "Open {bank} to move it". Unknown banks: no button. */
const BANK_LINKS: Record<string, string> = {
  chase: 'https://www.chase.com',
  'bank of america': 'https://www.bankofamerica.com',
  'wells fargo': 'https://www.wellsfargo.com',
  'capital one': 'https://www.capitalone.com',
  ally: 'https://www.ally.com',
};

export function bankFor(accountName: string): { name: string; url?: string } {
  const lower = accountName.toLowerCase();
  const known = Object.keys(BANK_LINKS).find((k) => lower.startsWith(k));
  const name = known
    ? accountName.slice(0, known.length)
    : accountName.replace(/\s+(checking|savings)$/i, '');
  return { name, url: known ? BANK_LINKS[known] : undefined };
}

export function buildMoveView(data: AppData, amountOverride?: Cents) {
  const t = weeklyTransfer(data);
  const amount = amountOverride ?? t.total;
  const perDay = availableToSpend(data).perDay;
  const names = [
    ...t.due.filter((o) => o.kind === 'bill').map((o) => o.name),
    ...t.due.filter((o) => o.kind === 'statement').map((o) => `${shortBank(o.name)} statement`),
  ];
  const billsTotal = t.due.reduce((s, o) => s + o.amount, 0);
  const rows = [
    ...(t.due.length
      ? [
          {
            title: 'Bills due this week',
            subtitle: names.join(', '),
            value: formatDollars(billsTotal),
          },
        ]
      : []),
    {
      title: 'Weekly spending',
      subtitle: `About ${formatDollars(perDay)} a day for a week`,
      value: formatDollars(t.spending),
    },
  ];
  const checking = data.accounts.find((a) => a.type === 'checking');
  const bank = bankFor(checking?.name ?? 'your bank');
  const close = t.habit > 0 && Math.abs(t.difference) <= t.habit * 0.1;
  return {
    title: 'Move money to checking',
    amount,
    comparison: close
      ? `You usually move ${formatDollars(t.habit)}. This week needs about the same.`
      : `You usually move ${formatDollars(t.habit)}. This week needs ${formatDollars(Math.abs(t.difference))} ${t.difference > 0 ? 'more' : 'less'}.`,
    rows,
    bank,
    note: `Move it in ${bank.name}, then come back. We’ll show it as pending until it arrives.`,
    openLabel: bank.url ? `Open ${bank.name} to move it` : undefined,
    movedLabel: 'I already moved it',
  };
}

// 08 Week reviewed -------------------------------------------------------------

const usualLine = (amount: Cents, average: Cents, label: string) =>
  label === 'about usual'
    ? 'About the same as usual'
    : `${formatDollars(Math.abs(amount - average))} ${label}`;

export function buildDoneView(data: AppData, pending: PendingTransfer | null) {
  const report = weekReport(data);
  const bar = spendBar(report.spent, report.allowance);
  const ats = availableToSpend(data);
  const income = ats.nextIncome;
  const days = `${ats.days} ${ats.days === 1 ? 'day' : 'days'}`;
  const checking = data.accounts.find((a) => a.type === 'checking');
  return {
    title: 'Week reviewed',
    subtitle: 'Here’s the short version.',
    spentLabel: 'You spent',
    spent: formatDollars(report.spent),
    bar,
    barLabel:
      bar.over > 0
        ? `${formatDollars(bar.over)} over your ${formatDollars(report.allowance)} weekly amount. Free covered it, so your savings weren’t touched.`
        : `${formatDollars(bar.left)} left of your ${formatDollars(report.allowance)} weekly amount.`,
    categories: report.topCategories.map((c) => ({
      title: c.category,
      subtitle: usualLine(c.amount, c.average, c.label),
      value: formatDollars(c.amount),
    })),
    left: [
      {
        bucket: 'free' as const,
        title: 'Free to spend',
        subtitle:
          income.kind === 'none'
            ? 'Over the next 30 days'
            : income.kind === 'paycheck'
              ? `${days} until payday on ${formatShortDate(income.date)}`
              : `${days} until your ${formatShortDate(income.date)} invoice`,
        value: formatDollars(ats.display),
      },
      ...(pending
        ? [
            {
              bucket: 'none' as const,
              title: 'Move to checking',
              subtitle: `Pending until it shows up in ${bankFor(checking?.name ?? 'checking').name}`,
              value: formatDollars(pending.amount),
            },
          ]
        : []),
    ],
    nextReview: `Next review ${formatWeekdayDate(nextReviewDate(data.today))}. We’ll remind you.`,
    primary: 'Done',
  };
}

// O6 + 09 Deposit split ---------------------------------------------------------

/** "unsplit" = the first split of savings that were never split; otherwise the landed deposit. */
export function depositAmount(data: AppData, id: string): Cents | undefined {
  if (id === 'unsplit') return savingsBalance(data);
  return data.pendingDeposit && data.pendingDeposit.id === id && !data.pendingDeposit.confirmed
    ? data.pendingDeposit.amount
    : undefined;
}

export const initialSplit = (data: AppData, id: string): Split | undefined => {
  const amount = depositAmount(data, id);
  if (amount === undefined) return undefined;
  return id === 'unsplit' ? unsplitPreview(data) : proposeSplit(data, amount);
};

export function buildSplitView(data: AppData, id: string, split: Split) {
  const amount = splitTotal(split);
  const unsplit = id === 'unsplit';
  const s = data.settings;
  const months = s.monthlySpend > 0 ? Math.round(s.runwayTarget / s.monthlySpend) : 0;
  const runwayBefore = unsplit ? 0 : data.buckets.runway;
  const runwayAfter = runwayBefore + split.runway;
  const fills = runwayAfter >= s.runwayTarget;
  const billsDue = billsDueNext30(data);
  const nextTax = data.taxYear?.nextQuarterlyDue;
  const notes: Record<BucketKey, string> = {
    tax:
      unsplit && nextTax
        ? `Set aside for ${formatShortDate(nextTax)}`
        : `${Math.round(s.taxRate * 100)}% of every deposit`,
    bills:
      billsDue === 0
        ? 'Nothing due in the next 30 days'
        : split.bills > 0
          ? 'Covers the next 30 days'
          : 'Already covered this month',
    runway: fills
      ? `Reaches your ${months}-month target`
      : `${formatMonths(runwayMonths(data, runwayAfter))} months · target ${months} months`,
    invest: split.invest > 0 ? 'Starts now that Runway is full' : 'Starts when Runway is full',
    free: 'Yours to spend',
  };
  const visible = BUCKET_KEYS.filter(
    (k) => (k !== 'tax' || taxApplies(data)) && (k !== 'invest' || data.settings.modules.invest),
  );
  const short = Math.max(s.runwayTarget - runwayAfter, 0);
  return {
    title: unsplit ? `${formatDollars(amount)} in savings` : `${formatDollars(amount)} just landed`,
    subtitle: unsplit
      ? 'Here’s a starting split. Change anything before you confirm.'
      : 'Here’s where it goes. Change anything before you confirm.',
    segments: visible.map((bucket) => ({ bucket, amount: split[bucket] })),
    barLabel: `Split: ${visible.map((k) => `${BUCKET_NAMES[k]} ${formatDollars(split[k])}`).join(', ')}`,
    rows: visible.map((bucket) => ({
      bucket,
      name: BUCKET_NAMES[bucket],
      note: notes[bucket],
      amount: split[bucket],
    })),
    note: !fills
      ? `Runway is ${formatDollars(short)} short of your ${months}-month target. Your next deposits fill it first.`
      : runwayBefore < s.runwayTarget
        ? `This ${unsplit ? 'split' : 'deposit'} fills Runway. From now on, what’s left after taxes, bills and Free goes to Invest.`
        : 'Runway is full, so what’s left after taxes, bills and Free goes to Invest.',
    total: amount,
    primary: 'Confirm split',
    quiet: unsplit ? 'Not now' : 'Edit amounts',
  };
}

/** 09b Change the split (Andy, 2026-09-28): Free absorbs every edit; saving is never blocked. */
export const SPLIT_EDIT = {
  title: 'Change the split',
  subtitle: 'Tap an amount to change it.',
  note: 'Whatever you don’t place goes to Free.',
  capped: 'That’s more than this deposit has left, so it stops at what fits.',
  primary: 'Save split',
  quiet: 'Use the suggested split',
} as const;

export function buildSetupView(
  data: AppData,
  taxRate: number,
  targetMonths: number,
  id = 'unsplit',
) {
  const target = data.settings.monthlySpend * targetMonths;
  const taxes = taxApplies(data);
  const deposit = depositAmount(data, id);
  // O6 note (Figma 70:981): what these two choices do to the split that comes next.
  const split = initialSplit(
    {
      ...data,
      settings: {
        ...data.settings,
        taxRate: taxes ? taxRate : data.settings.taxRate,
        runwayTarget: target,
      },
    },
    id,
  );
  const now = data.buckets.runway;
  const unsplit = id === 'unsplit';
  // From E3 (Andy, 2026-09-29): the savings' own numbers, never a deposit's.
  const runwayLine = !split
    ? ''
    : unsplit
      ? split.runway >= target
        ? ` ${formatDollars(split.runway)} of your savings goes to it, so it’s full.`
        : ` ${formatDollars(split.runway)} of your savings goes toward it.`
      : now >= target
        ? ` You’re at ${formatDollars(now)}, so it’s already full.`
        : ` You’re at ${formatDollars(now)}, so ${formatDollars(split.runway)} of this ${now + split.runway >= target ? 'fills it' : 'goes toward it'}.`;
  const taxLine =
    taxes && split && split.tax > 0 ? `${formatDollars(split.tax)} goes to taxes. ` : '';
  return {
    title: unsplit
      ? 'Before we split your savings'
      : deposit !== undefined
        ? `Your first deposit: ${formatDollars(deposit)}`
        : 'Before your first split',
    subtitle: unsplit
      ? 'Two quick choices. You can change both later in Settings.'
      : 'Two quick choices before we split it. You can change both later in Settings.',
    showTax: taxes,
    note: `${taxLine}Your Runway target becomes ${formatDollars(target)}.${runwayLine}`,
    target,
    primary: 'See the split',
  };
}

// S1 Transactions ---------------------------------------------------------------

export type TransactionFilter = 'all' | 'untagged' | 'tax';

export function buildTransactionsView(
  data: AppData,
  filter: TransactionFilter,
  accountId?: string,
) {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const taxes = taxApplies(data);
  const inScope = accountId
    ? data.transactions.filter((t) => t.accountId === accountId)
    : data.transactions;
  const untagged = inScope.filter((t) => !t.reviewed).length;
  const shown = inScope
    .filter((t) => filter === 'all' || (filter === 'tax' ? t.tax : !t.reviewed))
    .sort((a, b) => b.date.localeCompare(a.date) || a.merchant.localeCompare(b.merchant));
  const groups: {
    date: string;
    label: string;
    rows: { id: string; title: string; subtitle: string; value: string }[];
  }[] = [];
  for (const t of shown) {
    let group = groups.find((g) => g.date === t.date);
    if (!group) {
      group = { date: t.date, label: formatDayLabel(t.date, data.today), rows: [] };
      groups.push(group);
    }
    group.rows.push({
      id: t.id,
      title: t.merchant,
      subtitle: [
        t.category ?? t.suggestedCategory ?? 'Needs a tag',
        taxes && t.tax ? 'Work expense' : undefined,
        accountId ? undefined : accounts.get(t.accountId),
      ]
        .filter(Boolean)
        .join(' · '),
      value: formatLedgerCents(t.amount),
    });
  }
  return {
    title: (accountId && accounts.get(accountId)) || 'Transactions',
    filters: [
      { value: 'all' as const, label: 'All' },
      {
        value: 'untagged' as const,
        label: untagged ? `Needs a tag · ${untagged}` : 'Needs a tag',
      },
      ...(taxes ? [{ value: 'tax' as const, label: 'Work expense' }] : []),
    ],
    groups,
    empty:
      inScope.length === 0
        ? accountId
          ? 'No transactions from this account yet.'
          : 'No transactions yet. They show up after your first sync, usually within an hour of connecting a bank.'
        : shown.length === 0
          ? 'Nothing matches this filter.'
          : undefined,
  };
}

// S2 Taxes ---------------------------------------------------------------------

export function buildTaxesView(data: AppData) {
  const summary = taxSummary(data);
  const year = data.taxYear?.year ?? Number(data.today.slice(0, 4));
  return {
    title: `Taxes · ${year}`,
    year,
    sentence: `${formatDollars(summary.total)} in work expenses tagged this year. Your accountant gets this list, sorted.`,
    categories: summary.categories.map((c) => ({
      title: c.name,
      subtitle: `${c.items} ${c.items === 1 ? 'item' : 'items'}`,
      value: formatDollars(c.total),
    })),
    reserve: {
      title: 'Taxes',
      subtitle: data.taxYear
        ? `Next quarterly payment ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
        : undefined,
      value: formatDollars(data.buckets.tax),
    },
    taggedTransactions: data.transactions
      .filter((t) => t.tax)
      .map((t) => `${t.merchant} ${formatCents(t.amount)} (${taxCategoryOf(t)})`),
    primary: 'Share with my accountant',
    quiet: 'Save as PDF',
  };
}

// S9 Transaction detail --------------------------------------------------------

export function buildTransactionDetail(
  data: AppData,
  id: string,
  rules: readonly CategoryRule[] = [],
) {
  const t = data.transactions.find((x) => x.id === id);
  if (!t) return undefined;
  const name = data.accounts.find((a) => a.id === t.accountId)?.name;
  const account = name ? shortBank(name) : undefined;
  const category = t.category ?? t.suggestedCategory ?? 'Other';
  const categories = [
    ...new Set([category, ...(t.suggestedCategory ? [t.suggestedCategory] : []), ...CATEGORIES]),
  ];
  const taxCategory = taxCategoryOf(t);
  return {
    id: t.id,
    merchant: t.merchant,
    amount: formatLedgerCents(t.amount),
    // S9 (Figma 99:1244): "Mon, Sep 21 · Contoso".
    meta: [
      weekdayShort.format(new Date(`${t.date}T00:00:00Z`)),
      account,
      t.pending ? 'Pending' : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
    category,
    categories,
    showTaxes: taxApplies(data),
    tax: t.tax,
    taxCategory,
    taxCategories: [...new Set([...TAX_CATEGORIES, taxCategory])],
    ruleLabel: `Always treat ${t.merchant} this way`,
    /** A rule already covers this merchant (the switch is on). */
    ruleOn: rules.some((r) => r.merchant === normalizeMerchant(t.merchant)),
    /** S9 footnote: where a work expense shows up, and that changes save as you go. */
    note:
      t.tax && taxApplies(data)
        ? `In your ${data.today.slice(0, 4)} tax list. Changes save as you go.`
        : 'Changes save as you go.',
    ruleDone: `Saved. Future ${t.merchant} charges get ${category}${t.tax && taxApplies(data) ? ', tagged as a work expense' : ''}.`,
  };
}
