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
} from '@/domain';

import type { PendingTransfer } from './store';
import { BUCKET_NAMES, updatedLabel } from './views';

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

export function buildBalancesView(data: AppData, now: Date) {
  const syncedLabel = updatedLabel(data, now);
  const rows = data.accounts.map((a) => ({
    id: a.id,
    title: a.name,
    subtitle: a.source === 'manual' ? 'Entered by hand' : syncedLabel,
    editable: a.source === 'manual',
    value:
      a.type === 'card' || a.type === 'loan'
        ? `${formatDollars(a.balance)} owed`
        : formatDollars(a.balance),
  }));
  const manual = data.accounts.filter((a) => a.source === 'manual').map((a) => a.name);
  const imported = data.accounts.filter((a) => a.source === 'import').map((a) => a.name);
  return {
    title: 'Do these balances look right?',
    rows,
    importNote: imported.length
      ? `${listNames(imported)} ${imported.length === 1 ? 'comes' : 'come'} from files. Import this week’s download first, so the review sees every purchase.`
      : undefined,
    manualNote: manual.length
      ? `${listNames(manual)} ${manual.length === 1 ? 'is' : 'are'} entered by hand, so ${manual.length === 1 ? 'it shows' : 'they show'} your last update. Tap one to change it.`
      : undefined,
    primary: 'Looks right',
  };
}

// 05 Tag -----------------------------------------------------------------------

/** Two category chips per card: the suggestion, then "Other". (Decision: PROGRESS.md.) */
export const categoryChoices = (t: Transaction): string[] => {
  const suggested = t.suggestedCategory ?? t.category ?? 'Other';
  return suggested === 'Other' ? ['Other'] : [suggested, 'Other'];
};

export function buildTagView(data: AppData) {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const items = toTag(data).map((t) => ({
    id: t.id,
    merchant: t.merchant,
    dateLabel: formatShortDate(t.date),
    accountName: accounts.get(t.accountId) ?? '',
    amount: t.amount,
    suggestions: categoryChoices(t),
    selected: t.category ?? t.suggestedCategory,
    tax: t.tax,
  }));
  const n = items.length;
  return {
    title: n === 0 ? 'Nothing new to tag this week.' : `${n} new this week.`,
    subtitle:
      n === 0
        ? 'Every transaction already has a category.'
        : "We've guessed each category. Change any that are off.",
    items,
    showTax: taxApplies(data),
    primary: 'Looks right · Next',
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
        ? change.freeToSpend < 0
          ? `${formatDollarChange(change.freeToSpend)} — what you spent this week`
          : `${formatDollarChange(change.freeToSpend)} since the start of the week`
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
      title: 'Tax reserve',
      value: formatDollars(data.buckets.tax),
      line: data.taxYear
        ? `Next quarterly date ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
        : 'Set aside for taxes',
    });
  }
  const notable = notableCategory(weekReport(data));
  return {
    title: 'What changed this week',
    cards,
    note: notable
      ? `${notable.category} was ${formatDollars(notable.amount)} this week, ${notable.label} (4-week average ${formatDollars(notable.average)}).`
      : undefined,
    primary: 'Next',
  };
}

// 07b Habit (first review only) -------------------------------------------------

export function buildHabitView(data: AppData, habit: Cents) {
  const t = weeklyTransfer(data);
  const diff = t.total - habit;
  return {
    title: 'How much do you usually move to checking?',
    note:
      diff === 0
        ? `This week needs ${formatDollars(t.total)}, the same as usual.`
        : `This week needs ${formatDollars(t.total)} — ${formatDollars(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than usual.`,
    primary: 'Looks right · Next',
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
  const rows = [
    ...t.due.map((o) => ({
      title: o.kind === 'statement' ? `${o.name} statement` : o.name,
      subtitle: `Due ${formatShortDate(o.due)}`,
      value: formatDollars(o.amount),
    })),
    {
      title: 'Spending for 7 days',
      subtitle: `${formatDollars(perDay)} × 7`,
      value: formatDollars(t.spending),
    },
  ];
  const biggest = [...t.due].sort((a, b) => b.amount - a.amount)[0];
  const checking = data.accounts.find((a) => a.type === 'checking');
  const bank = bankFor(checking?.name ?? 'your bank');
  return {
    amount,
    comparison: `You usually move ${formatDollars(t.habit)}. This week needs ${formatDollars(t.total)}.`,
    rows,
    aboveHabit:
      t.difference > 0
        ? `That's ${formatDollars(t.difference)} more than usual${
            biggest
              ? ` — the ${biggest.kind === 'statement' ? `${biggest.name} statement` : biggest.name} (${formatDollars(biggest.amount)}) is due ${formatShortDate(biggest.due)}`
              : ''
          }.`
        : undefined,
    bank,
    openLabel: bank.url ? `Open ${bank.name} to move it` : undefined,
    howTo: bank.url
      ? undefined
      : `Move it in ${bank.name}'s app, then come back and tap "I already moved it".`,
    movedLabel: 'I already moved it',
  };
}

// 08 Week reviewed -------------------------------------------------------------

export function buildDoneView(data: AppData, pending: PendingTransfer | null) {
  const report = weekReport(data);
  const bar = spendBar(report.spent, report.allowance);
  const ats = availableToSpend(data);
  return {
    title: `You spent ${formatDollars(report.spent)}`,
    bar,
    barLabel:
      bar.over > 0
        ? `${formatDollars(bar.over)} over your ${formatDollars(report.allowance)} allowance`
        : `${formatDollars(bar.left)} left of your ${formatDollars(report.allowance)} allowance`,
    categories: report.topCategories.map((c) => ({
      title: c.category,
      subtitle: `${c.label} · usually ${formatDollars(c.average)}`,
      value: formatDollars(c.amount),
    })),
    left: [
      {
        title: 'Free to spend',
        subtitle: `About ${formatDollars(ats.perDay)} a day`,
        value: formatDollars(ats.display),
      },
      ...(pending
        ? [
            {
              title: 'Moving to checking',
              subtitle: 'Pending until it shows up in checking',
              value: formatDollars(pending.amount),
            },
          ]
        : []),
    ],
    nextReview: `Next review ${formatWeekdayDate(nextReviewDate(data.today))}. We'll remind you.`,
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
  const target = formatCompactThousands(data.settings.runwayTarget);
  const runwayAfter = data.buckets.runway + split.runway;
  const notes: Record<BucketKey, string> = {
    tax: unsplit
      ? `${Math.round(data.settings.taxRate * 100)}% of this quarter's income`
      : `${Math.round(data.settings.taxRate * 100)}% of this deposit`,
    bills: `${formatDollars(billsDueNext30(data))} due in the next 30 days`,
    runway:
      runwayAfter >= data.settings.runwayTarget
        ? `Reaches the ${target} target`
        : `Toward the ${target} target`,
    invest:
      split.invest > 0
        ? `Runway is full, so ${Math.round(data.settings.investShare * 100)}% of what’s left`
        : 'Unlocks once Runway is full',
    free: 'Yours to spend',
  };
  const visible = BUCKET_KEYS.filter(
    (k) => (k !== 'tax' || taxApplies(data)) && (k !== 'invest' || data.settings.modules.invest),
  );
  const source = data.pendingDeposit?.source;
  return {
    title: unsplit
      ? `Split your ${formatDollars(amount)} savings`
      : `${formatDollars(amount)} just landed`,
    subtitle: unsplit
      ? 'Label every dollar so Annum knows what’s spoken for.'
      : source
        ? `From ${source}.`
        : undefined,
    segments: visible.map((bucket) => ({ bucket, amount: split[bucket] })),
    barLabel: `Split: ${visible.map((k) => `${BUCKET_NAMES[k]} ${formatDollars(split[k])}`).join(', ')}`,
    rows: visible.map((bucket) => ({
      bucket,
      name: BUCKET_NAMES[bucket],
      note: notes[bucket],
      amount: split[bucket],
    })),
    note: 'Change any amount — Free takes up the difference, so the total stays the same.',
    total: amount,
    primary: 'Confirm split',
    quiet: 'Edit amounts',
  };
}

export function buildSetupView(data: AppData, taxRate: number, targetMonths: number) {
  const target = data.settings.monthlySpend * targetMonths;
  const taxes = taxApplies(data);
  return {
    title: 'Before your first split',
    showTax: taxes,
    note: taxes
      ? `${Math.round(taxRate * 100)}% goes to Tax, and Runway fills to ${formatCompactThousands(target)} (${targetMonths} months of spending) before anything goes to Invest.`
      : `Runway fills to ${formatCompactThousands(target)} (${targetMonths} months of spending) before anything goes to Invest.`,
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
  const account = data.accounts.find((a) => a.id === t.accountId)?.name;
  const category = t.category ?? t.suggestedCategory ?? 'Other';
  const categories = [
    ...new Set([category, ...(t.suggestedCategory ? [t.suggestedCategory] : []), ...CATEGORIES]),
  ];
  const taxCategory = taxCategoryOf(t);
  return {
    id: t.id,
    merchant: t.merchant,
    amount: formatLedgerCents(t.amount),
    meta: [formatShortDate(t.date), account, t.pending ? 'Pending' : undefined]
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
