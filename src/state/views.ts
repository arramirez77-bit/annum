/**
 * View models: what each screen shows, built from the engine. Pure functions (no React),
 * so every sentence is unit-tested. Screens render these; they never do money math.
 * Copy follows docs/01 voice rules: numbers inside sentences, cause then action, never "warning".
 */
import {
  availableToSpend,
  BUCKET_KEYS,
  estimatedRunwayMonths,
  estimatedSpend,
  formatDollars,
  formatMonths,
  formatMonthsChange,
  formatShortDate,
  headsUpCauses,
  inNextDays,
  runwayMonths,
  savingsBalance,
  staleAccounts,
  taxApplies,
  todayStatus,
  unsplitPreview,
  weeklyChanges,
  whatIf,
  type AppData,
  type BucketKey,
  type Cents,
  type HeadsUpCause,
  type NextIncome,
  type TodayStatus,
} from '@/domain';

import { CADENCE_WORD } from './settings-views';

export const BUCKET_NAMES: Record<BucketKey, string> = {
  tax: 'Taxes',
  bills: 'Bills',
  runway: 'Runway',
  invest: 'Invest',
  free: 'Free',
};

/** "Contoso Card" → "Contoso" (Figma 02: "Contoso statement"). */
const cardShortName = (name: string) => name.replace(/\s+card$/i, '');
/** "Woodgrove checking" → "Woodgrove" (Figma E1). */
const bankShortName = (name: string) => name.replace(/\s+(checking|savings)$/i, '');

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Updated 7:02 AM", or the stale account's date: "Updated Sep 20". */
export function updatedLabel(data: AppData, now: Date): string {
  const stale = staleAccounts(data, now);
  if (stale.length > 0) {
    const oldest = [...stale].sort((a, b) =>
      (a.lastSynced ?? '').localeCompare(b.lastSynced ?? ''),
    )[0];
    return `Updated ${formatShortDate((oldest.lastSynced ?? data.today).slice(0, 10))}`;
  }
  const latest = data.accounts
    .filter((a) => !!a.lastSynced)
    .sort((a, b) => (a.lastSynced ?? '').localeCompare(b.lastSynced ?? ''))
    .pop();
  if (!latest?.lastSynced) return 'Entered by hand';
  // Imports happen by hand, so the day matters more than the time.
  return latest.source === 'import'
    ? `Imported ${formatShortDate(latest.lastSynced.slice(0, 10))}`
    : `Updated ${time.format(new Date(latest.lastSynced))}`;
}

const incomeWord = (income: NextIncome) => (income.kind === 'paycheck' ? 'payday' : 'your invoice');

/** "until your next invoice on Oct 13. About $50 a day." */
export function spendSentence(income: NextIncome, perDay: Cents, days: number): string {
  const daily =
    days <= 0 ? `About ${formatDollars(perDay)} today.` : `About ${formatDollars(perDay)} a day.`;
  const date = formatShortDate(income.date);
  switch (income.kind) {
    case 'paycheck':
      return days <= 0
        ? `before payday lands today. ${daily}`
        : `until payday on ${date}. ${daily}`;
    case 'late':
      return `until ${date}, when we expect the late invoice. ${daily}`;
    case 'none':
      return `over the next 30 days. ${daily}`;
    default:
      return days <= 0
        ? `before your invoice lands today. ${daily}`
        : `until your next invoice on ${date}. ${daily}`;
  }
}

/** Compact Today (01c, screens under 700pt): one line, "until Oct 13 · about $50 a day". */
export function compactSentence(income: NextIncome, perDay: Cents, days: number): string {
  const daily = `about ${formatDollars(perDay)} a day`;
  if (days <= 0) return `today · about ${formatDollars(perDay)}`;
  switch (income.kind) {
    case 'paycheck':
      return `until payday ${formatShortDate(income.date)} · ${daily}`;
    case 'none':
      return `next 30 days · ${daily}`;
    default:
      return `until ${formatShortDate(income.date)} · ${daily}`;
  }
}

/** The one heads-up cause Today names (most important first). */
export function causeSentence(cause: HeadsUpCause, income: NextIncome): string {
  switch (cause.kind) {
    case 'late-income':
      return `The ${cause.source ?? 'expected'} invoice is ${cause.daysLate} ${cause.daysLate === 1 ? 'day' : 'days'} late, so we stretched it.`;
    case 'statement-before-income':
      return `The ${cardShortName(cause.name)} statement lands before ${incomeWord(income)} does.`;
    case 'low-per-day':
      return `That’s under ${formatDollars(2000)} a day until ${income.kind === 'paycheck' ? 'payday' : 'your next invoice'}.`;
  }
}

/**
 * 01c one-liner when a heads-up cause is behind the number ("until Oct 13 · Contoso statement
 * first"): the full sentence would shrink to fit one line on a small screen.
 */
function compactCause(cause: HeadsUpCause, income: NextIncome, perDay: Cents, days: number) {
  const until = `until ${formatShortDate(income.date)}`;
  switch (cause.kind) {
    case 'late-income':
      return `${until} · invoice ${cause.daysLate} ${cause.daysLate === 1 ? 'day' : 'days'} late`;
    case 'statement-before-income':
      return `${until} · ${cardShortName(cause.name)} statement first`;
    case 'low-per-day':
      return compactSentence(income, perDay, days);
  }
}

export interface TodayRow {
  id: 'runway' | 'tax' | 'income' | 'paycheck' | 'statement' | 'invoice' | 'per-day' | 'what-if';
  title: string;
  subtitle?: string;
  value?: string;
  /** Bucket dot; 'none' keeps titles aligned in a list with dots; omit when no row has one. */
  bucket?: BucketKey | 'none';
  route?:
    '/what-if' | '/income/new' | '/settings/number/spend' | '/settings/number/pay' | '/money/taxes';
}

/** Where Today's button goes: the weekly review, or S4 to change a late invoice's date. */
export type TodayButtonRoute = { pathname: '/review' } | { pathname: '/income/new'; edit: string };

export interface TodayView {
  status: TodayStatus;
  /** Umber field and Caution button. */
  caution: boolean;
  dateLabel: string;
  updatedLabel: string;
  /** "You can spend" / "You can spend about" (estimate or stale). */
  lead: string;
  amount: Cents;
  sentence: string;
  /** 01c: the one-line sentence for short screens. */
  compactSentence: string;
  /** Header: "Sep 23 · Updated 7:02 AM", or only "Updated Sep 20" when out of date (E1). */
  headerLabel: string;
  staleNote?: string;
  /** Tapping the stale note: reconnect that bank, or import its file. */
  staleRoute?:
    | { pathname: '/bank/connect'; item: string }
    | { pathname: '/import' }
    | { pathname: '/settings' };
  /** Nothing to plan with yet (every step of onboarding skipped). */
  emptyNote?: string;
  rows: TodayRow[];
  button: { variant: 'field' | 'caution'; label: string; route: TodayButtonRoute };
  /** One sentence VoiceOver reads for the hero. */
  heroLabel: string;
}

const WHAT_IF: TodayRow = {
  id: 'what-if',
  title: 'What would this do?',
  subtitle: 'Try a purchase before you buy it',
  bucket: 'none',
  route: '/what-if',
};

export function buildTodayView(data: AppData, now: Date): TodayView {
  const status = todayStatus(data);
  const estimate = status === 'estimate';
  const stale = staleAccounts(data, now);
  const ats = availableToSpend(data);
  const spend = estimate
    ? estimatedSpend(data)
    : { amount: ats.display, perDay: ats.perDay, days: ats.days };
  const causes = status === 'heads-up' ? headsUpCauses(data, ats) : [];
  const first = causes[0];
  const about = estimate || stale.length > 0;
  const lead = about ? 'You can spend about' : 'You can spend';
  const until = `until ${formatShortDate(ats.nextIncome.date)}.`;
  // Heads up (02, E2): the cause is part of the sentence, after the date.
  const sentence = first
    ? `${until} ${causeSentence(first, ats.nextIncome)}`
    : spendSentence(ats.nextIncome, spend.perDay, spend.days);

  const s = data.settings;
  const months = s.monthlySpend > 0 ? Math.round(s.runwayTarget / s.monthlySpend) : 0;
  const runwayValue = `${formatMonths(runwayMonths(data))} months`;
  const change = weeklyChanges(data);
  const runwaySubtitle = change
    ? `${formatMonthsChange(change.runwayMonths)}${change.runwayMonths !== 0 ? ' months' : ''} this week · target ${months} months`
    : `Target ${months} months (${formatDollars(s.runwayTarget)})`;
  const runwayRow: TodayRow =
    s.monthlySpend <= 0
      ? {
          id: 'runway',
          title: 'Runway',
          bucket: 'runway',
          value: 'Not set yet',
          subtitle: 'Tell Annum what a month costs you',
          route: '/settings/number/spend',
        }
      : estimate
        ? {
            id: 'runway',
            title: 'Runway',
            bucket: 'runway',
            value: `About ${estimatedRunwayMonths(data)} months`,
            subtitle: 'Estimated from your accounts',
          }
        : {
            id: 'runway',
            title: 'Runway',
            bucket: 'runway',
            value: runwayValue,
            subtitle: runwaySubtitle,
          };
  const taxRow: TodayRow | undefined = taxApplies(data)
    ? data.savingsUnsplit
      ? {
          id: 'tax',
          title: 'Taxes',
          bucket: 'tax',
          value: 'Not yet',
          subtitle: 'You’ll set this when your first deposit lands',
        }
      : {
          id: 'tax',
          title: 'Taxes',
          bucket: 'tax',
          value: formatDollars(data.buckets.tax),
          subtitle: data.taxYear
            ? `Next payment ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
            : undefined,
          // Opens S2 Taxes (Andy, 2026-09-28).
          route: '/money/taxes',
        }
    : undefined;

  let rows: TodayRow[];
  let button: TodayView['button'] = {
    variant: 'field',
    label: estimate ? 'Start my first review' : 'Start weekly review',
    route: { pathname: '/review' },
  };
  if (first?.kind === 'late-income') {
    // E2: the late invoice and what it does to the daily amount.
    const late = ats.nextIncome;
    const income = data.expectedIncome.find(
      (i) => !i.received && i.date === late.dueDate && i.source === late.source,
    );
    rows = [
      {
        id: 'invoice',
        title: `${late.source ?? 'Expected'} invoice`,
        subtitle: `Expected ${formatShortDate(late.dueDate ?? late.date)} · ${late.daysLate} ${late.daysLate === 1 ? 'day' : 'days'} late`,
        value: late.amount !== undefined ? formatDollars(late.amount) : undefined,
      },
      {
        id: 'per-day',
        title: 'Per day',
        subtitle: `Stretched to ${formatShortDate(late.date)}`,
        value: formatDollars(spend.perDay),
      },
      { ...WHAT_IF, bucket: undefined },
    ];
    button = income
      ? {
          variant: 'caution',
          label: 'Change the invoice date',
          route: { pathname: '/income/new', edit: income.id },
        }
      : { variant: 'caution', label: 'See my options', route: { pathname: '/review' } };
  } else if (first?.kind === 'statement-before-income') {
    // 02: the statement, and Runway staying whole if it's paid from Free.
    const due = ats.obligations.find((o) => o.kind === 'statement' && o.name === first.name)?.due;
    rows = [
      {
        id: 'statement',
        title: `${cardShortName(first.name)} statement`,
        subtitle: `${due ? `Due ${formatShortDate(due)} · ` : ''}paying in full avoids interest`,
        value: formatDollars(first.amount),
        bucket: 'none',
      },
      {
        id: 'runway',
        title: 'Runway stays',
        subtitle: 'If you pay it from Free, not savings',
        value: runwayValue,
        bucket: 'runway',
      },
      WHAT_IF,
    ];
    button = { variant: 'caution', label: 'See what I can move', route: { pathname: '/review' } };
  } else {
    rows = [runwayRow, ...(taxRow ? [taxRow] : [])];
    const pay = s.paySchedule;
    if (ats.nextIncome.kind === 'paycheck' && pay) {
      rows.push({
        id: 'paycheck',
        title: 'Next paycheck',
        subtitle: `${formatShortDate(ats.nextIncome.date)} · ${CADENCE_WORD[pay.cadence]}`,
        value: formatDollars(pay.amount),
        bucket: 'none',
      });
    }
    if (ats.nextIncome.kind === 'none') {
      const salary = s.incomeType === 'salary';
      rows.push({
        id: 'income',
        title: salary ? 'When’s your next payday?' : 'When’s your next invoice?',
        subtitle: 'Until then, Annum plans 30 days ahead',
        bucket: 'none',
        route: salary ? '/settings/number/pay' : '/income/new',
      });
    }
    // E1: out-of-date numbers leave out "What would this do?".
    if (stale.length === 0) rows.push(WHAT_IF);
    if (status === 'heads-up') {
      button = { variant: 'caution', label: 'See what I can move', route: { pathname: '/review' } };
    }
  }

  const oldest = stale[0];
  const staleDay = oldest ? formatShortDate((oldest.lastSynced ?? '').slice(0, 10)) : '';
  const staleNote = oldest
    ? oldest.source === 'import'
      ? `${oldest.name} was last imported ${staleDay}, so this may be off by a few purchases. Import this week’s file to catch up.`
      : `${bankShortName(oldest.name)} hasn’t synced since ${staleDay}, so this may be off by a few purchases. Tap to reconnect.`
    : undefined;
  const staleRoute: TodayView['staleRoute'] = oldest
    ? oldest.source === 'import'
      ? { pathname: '/import' }
      : oldest.source === 'plaid' && oldest.itemId
        ? { pathname: '/bank/connect', item: oldest.itemId }
        : { pathname: '/settings' }
    : undefined;
  const updated = updatedLabel(data, now);

  return {
    status,
    caution: status === 'heads-up',
    dateLabel: formatShortDate(data.today),
    updatedLabel: updated,
    headerLabel: stale.length ? updated : `${formatShortDate(data.today)} · ${updated}`,
    lead,
    amount: spend.amount,
    sentence,
    compactSentence: first
      ? compactCause(first, ats.nextIncome, spend.perDay, spend.days)
      : compactSentence(ats.nextIncome, spend.perDay, spend.days),
    staleNote,
    staleRoute,
    emptyNote: data.accounts.every((a) => a.balance === 0)
      ? 'No balances yet, so there’s nothing to count. Add them in Settings → Accounts.'
      : undefined,
    rows,
    button,
    heroLabel: `${lead} ${formatDollars(spend.amount)} ${sentence}`,
  };
}

export interface MoneyRow {
  bucket: BucketKey;
  name: string;
  note: string;
  amount: Cents;
}

export interface MoneyView {
  savings: Cents;
  unsplit: boolean;
  segments: { bucket: BucketKey; amount: Cents }[];
  barLabel: string;
  rows: MoneyRow[];
  /** E3: what a first split would look like. */
  previewNote?: string;
  showTaxes: boolean;
  taxYearLabel?: string;
}

/** E3 (Figma 70:1119): "A split could look like this: $3,000 for taxes, $2,000 for bills, …" */
function previewSentence(
  data: AppData,
  preview: Record<BucketKey, Cents>,
  visible: readonly BucketKey[],
): string {
  const words: Partial<Record<BucketKey, string>> = {
    tax: 'for taxes',
    bills: 'for bills',
    invest: 'to invest',
    free: 'to spend',
  };
  const parts = visible
    .filter((k) => k !== 'runway' && preview[k] > 0)
    .map((k) => `${formatDollars(preview[k])} ${words[k]}`);
  const months = `That’s about ${formatMonths(runwayMonths(data, preview.runway))} months.`;
  return parts.length
    ? `A split could look like this: ${parts.join(', ')}, and the rest in Runway. ${months}`
    : `A split could put all of it in Runway. ${months}`;
}

export function buildMoneyView(data: AppData): MoneyView {
  const savings = savingsBalance(data);
  const s = data.settings;
  const months = s.monthlySpend > 0 ? Math.round(s.runwayTarget / s.monthlySpend) : 0;
  const billsDue = data.bills.filter(
    (b) => b.confirmed && inNextDays(b.due, data.today, 30),
  ).length;
  // 03 Money (Figma 58:62): one short line per bucket.
  const notes: Record<BucketKey, string> = {
    tax: data.taxYear
      ? `Next payment ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
      : 'Set aside for taxes',
    bills: billsDue ? `${billsDue} due in 30 days` : 'Nothing due in 30 days',
    runway: `${formatMonths(runwayMonths(data))} months · target ${months} months`,
    invest: data.buckets.invest > 0 ? 'Ready to invest' : 'Starts when Runway is full',
    free: 'Counts toward what you can spend',
  };
  const visible = BUCKET_KEYS.filter(
    (k) => (k !== 'tax' || taxApplies(data)) && (k !== 'invest' || data.settings.modules.invest),
  );
  const unsplit = data.savingsUnsplit;
  const preview = unsplit ? unsplitPreview(data) : undefined;
  const segments = visible.map((bucket) => ({
    bucket,
    amount: unsplit && preview ? preview[bucket] : data.buckets[bucket],
  }));
  return {
    savings,
    unsplit,
    segments,
    barLabel: unsplit
      ? `Savings of ${formatDollars(savings)}, not split into buckets yet`
      : `Savings: ${segments.map((s) => `${BUCKET_NAMES[s.bucket]} ${formatDollars(s.amount)}`).join(', ')}`,
    rows: visible.map((bucket) => ({
      bucket,
      name: BUCKET_NAMES[bucket],
      note: unsplit ? 'Not split yet' : notes[bucket],
      amount: unsplit ? 0 : data.buckets[bucket],
    })),
    previewNote: preview ? previewSentence(data, preview, visible) : undefined,
    showTaxes: taxApplies(data),
    taxYearLabel: data.taxYear ? `Taxes · ${data.taxYear.year}` : undefined,
  };
}

export interface WhatIfView {
  empty: boolean;
  rows: {
    id: 'free' | 'per-day' | 'runway' | 'target';
    title: string;
    subtitle?: string;
    value: string;
    amount?: Cents;
  }[];
  helper: string;
  guardrail: boolean;
  note: string;
  primary: string;
  quiet: string;
  waitUntil?: string;
}

/**
 * S4 helper under the amount: what's left after the Tax bucket takes its share (the same rule
 * as a deposit's split). None without the Tax module, or before an amount is typed.
 */
export function incomeHelper(data: AppData, amount: Cents | null): string | undefined {
  if (!amount || !taxApplies(data)) return undefined;
  const afterTax = amount - Math.round(amount * data.settings.taxRate);
  return `After taxes, about ${formatDollars(afterTax)} of this is yours to plan.`;
}

/** 10 fits · 11 guardrail (Figma 60:416, 60:463). */
export function buildWhatIfView(data: AppData, purchase: Cents | null): WhatIfView {
  const ats = availableToSpend(data);
  const result = whatIf(data, purchase ?? 0);
  const waitDate = formatShortDate(result.waitUntil);
  const empty = purchase === null || purchase === 0;
  const was = (v: Cents) => (empty ? undefined : `Was ${formatDollars(v)}`);
  const s = data.settings;
  const months = s.monthlySpend > 0 ? Math.round(s.runwayTarget / s.monthlySpend) : 0;
  const free = {
    id: 'free' as const,
    title: 'Free to spend',
    subtitle: was(ats.display),
    value: formatDollars(result.ats),
    amount: result.ats,
  };
  const runway = {
    id: 'runway' as const,
    title: 'Runway',
    subtitle: empty
      ? undefined
      : result.guardrail
        ? 'The rest would come from savings'
        : 'Unchanged',
    value: `${formatMonths(result.runwayMonths)} months`,
  };
  const base = { helper: 'Nothing is saved. This is only a preview.' };
  if (result.guardrail && !empty) {
    const lands =
      ats.nextIncome.kind === 'paycheck'
        ? `Payday is ${waitDate}`
        : `Your ${ats.nextIncome.kind === 'late' ? 'late ' : ''}invoice lands ${waitDate}`;
    const lead =
      result.beyondRunway > 0
        ? `That’s ${formatDollars(result.beyondRunway)} more than Free to spend and all of Runway together.`
        : data.buckets.runway >= s.runwayTarget
          ? 'This would put Runway under your target.'
          : `This would take ${formatDollars(result.shortfall)} out of Runway.`;
    return {
      ...base,
      empty: false,
      rows: [
        free,
        runway,
        {
          id: 'target',
          title: 'Your Runway target',
          subtitle: formatDollars(s.runwayTarget),
          value: `${months} months`,
        },
      ],
      guardrail: true,
      note: `${lead} ${lands}, and if you wait until then, your savings stay whole. We’ll ask you again when it lands.`,
      primary: `Wait until ${waitDate}`,
      quiet: 'Buy anyway',
      waitUntil: result.waitUntil,
    };
  }
  const rows: WhatIfView['rows'] = [
    free,
    {
      id: 'per-day',
      title: `Per day until ${waitDate}`,
      subtitle: was(ats.perDay),
      value: formatDollars(result.perDay),
      amount: result.perDay,
    },
    runway,
  ];
  return empty
    ? {
        ...base,
        empty: true,
        rows,
        guardrail: false,
        note: 'Type an amount to see what it would do.',
        primary: 'Got it',
        quiet: 'Try another amount',
      }
    : {
        ...base,
        empty: false,
        rows,
        guardrail: false,
        note: 'This fits. It comes out of Free, and your savings stay where they are.',
        primary: 'Got it',
        quiet: 'Try another amount',
      };
}
