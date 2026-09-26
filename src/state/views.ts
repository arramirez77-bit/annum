/**
 * View models: what each screen shows, built from the engine. Pure functions (no React),
 * so every sentence is unit-tested. Screens render these; they never do money math.
 * Copy follows docs/01 voice rules: numbers inside sentences, cause then action, never "warning".
 */
import {
  availableToSpend,
  billsDueNext30,
  BUCKET_KEYS,
  estimatedRunwayMonths,
  estimatedSpend,
  formatCompactThousands,
  formatDollars,
  formatMonths,
  formatMonthsChange,
  formatShortDate,
  headsUpCauses,
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

export const BUCKET_NAMES: Record<BucketKey, string> = {
  tax: 'Tax',
  bills: 'Bills',
  runway: 'Runway',
  invest: 'Invest',
  free: 'Free',
};

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
  const synced = data.accounts
    .map((a) => a.lastSynced)
    .filter((s): s is string => !!s)
    .sort();
  const latest = synced[synced.length - 1];
  return latest ? `Updated ${time.format(new Date(latest))}` : 'Entered by hand';
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
      return `The ${cause.source ?? 'expected'} invoice is ${cause.daysLate} ${cause.daysLate === 1 ? 'day' : 'days'} late.`;
    case 'statement-before-income':
      return `The ${cause.name} statement (${formatDollars(cause.amount)}) lands before ${incomeWord(income)} does.`;
    case 'low-per-day':
      return `That's under ${formatDollars(2000)} a day until ${income.kind === 'paycheck' ? 'payday' : 'your next invoice'}.`;
  }
}

export interface TodayRow {
  id: 'runway' | 'tax' | 'income' | 'what-if';
  title: string;
  subtitle?: string;
  value?: string;
  bucket: BucketKey | 'none';
  route?: '/what-if' | '/income/new' | '/settings/number/spend' | '/settings/number/pay';
}

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
  cause?: string;
  staleNote?: string;
  /** Nothing to plan with yet (every step of onboarding skipped). */
  emptyNote?: string;
  rows: TodayRow[];
  button: { variant: 'field' | 'caution'; label: string };
  /** One sentence VoiceOver reads for the hero. */
  heroLabel: string;
}

export function buildTodayView(data: AppData, now: Date): TodayView {
  const status = todayStatus(data);
  const estimate = status === 'estimate';
  const stale = staleAccounts(data, now);
  const ats = availableToSpend(data);
  const spend = estimate
    ? estimatedSpend(data)
    : { amount: ats.display, perDay: ats.perDay, days: ats.days };
  const causes = status === 'heads-up' ? headsUpCauses(data, ats) : [];
  const late = causes.some((c) => c.kind === 'late-income');
  const about = estimate || stale.length > 0;
  const lead = about ? 'You can spend about' : 'You can spend';
  const sentence = spendSentence(ats.nextIncome, spend.perDay, spend.days);
  const cause = causes[0] ? causeSentence(causes[0], ats.nextIncome) : undefined;

  const target = formatCompactThousands(data.settings.runwayTarget);
  const change = weeklyChanges(data);
  const runwaySubtitle = estimate
    ? `Estimated from savings · ${target} target`
    : change
      ? `${formatMonthsChange(change.runwayMonths)} this week · ${target} target`
      : `${target} target`;
  const noSpend = data.settings.monthlySpend <= 0;
  const rows: TodayRow[] = [
    noSpend
      ? {
          id: 'runway',
          title: 'Runway',
          bucket: 'runway',
          value: 'Not set yet',
          subtitle: 'Tell Annum what a month costs you',
          route: '/settings/number/spend',
        }
      : {
          id: 'runway',
          title: 'Runway',
          bucket: 'runway',
          value: estimate
            ? `~${estimatedRunwayMonths(data)} mo`
            : `${formatMonths(runwayMonths(data))} mo`,
          subtitle: runwaySubtitle,
        },
  ];
  if (taxApplies(data)) {
    rows.push({
      id: 'tax',
      title: 'Tax reserve',
      bucket: 'tax',
      value: data.savingsUnsplit ? 'Not set aside yet' : formatDollars(data.buckets.tax),
      subtitle: data.taxYear
        ? `Next quarterly date ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
        : undefined,
    });
  }
  if (ats.nextIncome.kind === 'none') {
    const salary = data.settings.incomeType === 'salary';
    rows.push({
      id: 'income',
      title: salary ? 'When’s your next payday?' : 'When’s your next invoice?',
      subtitle: 'Until then, Annum plans 30 days ahead',
      bucket: 'none',
      route: salary ? '/settings/number/pay' : '/income/new',
    });
  }
  rows.push({ id: 'what-if', title: 'What would this do?', bucket: 'none', route: '/what-if' });

  const button: TodayView['button'] = estimate
    ? { variant: 'field', label: 'Do my first weekly review' }
    : status === 'heads-up'
      ? { variant: 'caution', label: late ? 'See my options' : 'See what I can move' }
      : { variant: 'field', label: 'Start weekly review' };

  const staleNote = stale[0]
    ? `${stale[0].name} hasn't synced since ${formatShortDate((stale[0].lastSynced ?? '').slice(0, 10))}, so this may be off by a few purchases.`
    : undefined;

  return {
    status,
    caution: status === 'heads-up',
    dateLabel: formatShortDate(data.today),
    updatedLabel: updatedLabel(data, now),
    lead,
    amount: spend.amount,
    sentence,
    compactSentence: compactSentence(ats.nextIncome, spend.perDay, spend.days),
    cause,
    staleNote,
    emptyNote: data.accounts.every((a) => a.balance === 0)
      ? 'No balances yet, so there’s nothing to count. Add them in Settings → Accounts.'
      : undefined,
    rows,
    button,
    heroLabel: [`${lead} ${formatDollars(spend.amount)} ${sentence}`, cause]
      .filter(Boolean)
      .join(' '),
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

export function buildMoneyView(data: AppData): MoneyView {
  const savings = savingsBalance(data);
  const target = formatCompactThousands(data.settings.runwayTarget);
  const runwayFull = data.buckets.runway >= data.settings.runwayTarget;
  const notes: Record<BucketKey, string> = {
    tax: data.taxYear
      ? `Set aside for taxes · next quarterly date ${formatShortDate(data.taxYear.nextQuarterlyDue)}`
      : 'Set aside for taxes',
    bills: `${formatDollars(billsDueNext30(data))} in bills due in the next 30 days`,
    runway: `${formatMonths(runwayMonths(data))} months · ${target} target`,
    invest: runwayFull
      ? 'Runway is full, so this is ready to invest'
      : `Unlocks once Runway reaches ${target}`,
    free: 'Yours to spend',
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
    previewNote: preview
      ? `A first split would set aside ${visible
          .filter((k) => k !== 'free' && preview[k] > 0)
          .map((k) => `${BUCKET_NAMES[k]} ${formatDollars(preview[k])}`)
          .join(' · ')}, leaving Free ${formatDollars(preview.free)}.`
      : undefined,
    showTaxes: taxApplies(data),
    taxYearLabel: data.taxYear ? `Taxes · ${data.taxYear.year}` : undefined,
  };
}

export interface WhatIfView {
  empty: boolean;
  rows: { id: 'free' | 'per-day' | 'runway'; title: string; value: string; amount?: Cents }[];
  guardrail: boolean;
  note: string;
  primary: string;
  quiet: string;
  waitUntil?: string;
}

export function buildWhatIfView(data: AppData, purchase: Cents | null): WhatIfView {
  const ats = availableToSpend(data);
  const result = whatIf(data, purchase ?? 0);
  const waitDate = formatShortDate(result.waitUntil);
  const rows: WhatIfView['rows'] = [
    { id: 'free', title: 'Free to spend', value: formatDollars(result.ats), amount: result.ats },
    { id: 'per-day', title: 'Per day', value: formatDollars(result.perDay), amount: result.perDay },
    { id: 'runway', title: 'Runway', value: `${formatMonths(result.runwayMonths)} mo` },
  ];
  if (purchase === null || purchase === 0) {
    return {
      empty: true,
      rows,
      guardrail: false,
      note: 'Type an amount to see what it would do.',
      primary: 'Got it',
      quiet: 'Try another amount',
    };
  }
  if (result.guardrail) {
    const wait = `Waiting until ${waitDate}, when ${incomeWord(ats.nextIncome)} arrives, keeps Runway whole.`;
    return {
      empty: false,
      rows,
      guardrail: true,
      note:
        result.beyondRunway > 0
          ? `That's ${formatDollars(result.beyondRunway)} more than Free to spend and all of Runway together. ${wait}`
          : `This would dip ${formatDollars(result.shortfall)} into Runway (${formatMonths(runwayMonths(data))} → ${formatMonths(result.runwayMonths)} months). ${wait}`,
      primary: `Wait until ${waitDate}`,
      quiet: 'Buy anyway',
      waitUntil: result.waitUntil,
    };
  }
  return {
    empty: false,
    rows,
    guardrail: false,
    note: `That fits. You'd still have about ${formatDollars(result.perDay)} a day until ${waitDate}.`,
    primary: 'Got it',
    quiet: 'Try another amount',
  };
}
