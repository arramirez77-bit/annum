/**
 * TEST-ONLY reference implementation of the formulas in docs/03-DATA-MODEL.md.
 *
 * It lets the documented test cases run against fixtures/ from M0, so any edit to the
 * fixtures or the docs that breaks a documented number fails CI. It is not app code.
 * In M1 the spec tests switch to the real engine in src/domain/ and this file is deleted.
 */
import scenariosJson from '../../fixtures/scenarios.json';
import seedJson from '../../fixtures/seed.json';

type Cents = number;
type ISODate = string;

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'card' | 'brokerage' | 'loan';
  balance: Cents;
  statementBalance?: Cents;
  statementDue?: ISODate | null;
  lastSynced?: string;
}
export interface Bill {
  id: string;
  name: string;
  amount: Cents;
  due: ISODate;
  confirmed: boolean;
  payFrom: string;
}
interface Buckets {
  tax: Cents;
  bills: Cents;
  runway: Cents;
  invest: Cents;
  free: Cents;
}
export interface Fixture {
  today: ISODate;
  weekStart: { date: ISODate; availableToSpend: Cents; runway: Cents };
  settings: {
    incomeType: 'freelance' | 'salary' | 'both';
    taxRate: number;
    runwayTarget: Cents;
    monthlySpend: Cents;
    isEstimate: boolean;
    investShare: number;
    paySchedule?: { amount: Cents; next: ISODate };
  };
  accounts: Account[];
  buckets: Buckets;
  bills: Bill[];
  expectedIncome: { id: string; amount: Cents; date: ISODate; received?: boolean }[];
  transactions: { date: ISODate; amount: Cents; category?: string }[];
  thisWeek: { spent: Cents; byCategory: Record<string, Cents>; fourWeekAvg: Record<string, Cents> };
  taxYear: { byCategory: Record<string, Cents>; itemsByCategory: Record<string, number> };
  pendingDeposit: { date: ISODate; amount: Cents };
  _lateAssumeDays?: number;
  _expect?: { ATS: Cents; daysUntilIncome: number; perDay: Cents };
}

// ---------- fixtures (scenarios deep-merge over the seed; arrays merge by id) ----------
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function merge(base: unknown, over: unknown): unknown {
  if (Array.isArray(base) && isObj(over)) {
    return base.map((item) => {
      const id = (item as { id: string }).id;
      return id in over ? merge(item, over[id]) : item;
    });
  }
  if (isObj(base) && isObj(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(over))
      out[key] = key in base ? merge(base[key], over[key]) : over[key];
    return out;
  }
  return over;
}

export const seed = seedJson as unknown as Fixture;
const scenarios = scenariosJson as unknown as Record<string, unknown>;
export const scenario = (name: string): Fixture => merge(seed, scenarios[name]) as Fixture;

// ---------- dates (local calendar dates as YYYY-MM-DD strings) ----------
const ms = (d: ISODate) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: ISODate, n: number): ISODate =>
  new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((ms(b) - ms(a)) / 86_400_000);
export const localIsoDate = (dt: Date): ISODate =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// ---------- money helpers ----------
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const floorDollars = (c: Cents) => Math.floor(c / 100) * 100;
export const oneDecimal = (x: number) => Math.round(x * 10) / 10;
export const account = (s: Fixture, type: Account['type']) => {
  const found = s.accounts.find((a) => a.type === type);
  if (!found) throw new Error(`no ${type} account`);
  return found;
};

// ---------- formulas ----------
export function nextIncome(s: Fixture, today: ISODate = s.today) {
  if (s.settings.incomeType === 'salary' && s.settings.paySchedule) {
    return { date: s.settings.paySchedule.next, late: false };
  }
  const upcoming = s.expectedIncome
    .filter((i) => !i.received && i.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (upcoming) return { date: upcoming.date, late: false };
  return { date: addDays(today, s._lateAssumeDays ?? 5), late: true };
}

/** Available to Spend. Window: [today, next income date). */
export function ats(s: Fixture) {
  const { date: income, late } = nextIncome(s);
  const inWindow = (d?: ISODate | null) => !!d && d >= s.today && d < income;
  const bills = s.bills.filter((b) => b.confirmed && b.payFrom === 'checking' && inWindow(b.due));
  const cards = s.accounts.filter((a) => a.type === 'card' && inWindow(a.statementDue));
  const raw =
    account(s, 'checking').balance +
    s.buckets.free -
    sum(bills.map((b) => b.amount)) -
    sum(cards.map((c) => c.statementBalance ?? 0));
  const days = daysBetween(s.today, income);
  return {
    raw,
    display: Math.max(raw, 0),
    days,
    perDay: floorDollars(Math.max(raw, 0) / days),
    income,
    late,
    cards,
  };
}

export const runwayMonths = (s: Fixture) => oneDecimal(s.buckets.runway / s.settings.monthlySpend);

export function status(s: Fixture): 'on-track' | 'heads-up' | 'estimate' {
  if (s.settings.isEstimate) return 'estimate';
  const a = ats(s);
  const cardShort = a.cards.some((c) => a.raw < (c.statementBalance ?? 0));
  return cardShort || a.perDay < 2000 || a.late ? 'heads-up' : 'on-track';
}

export const isStale = (s: Fixture, now: string) =>
  s.accounts.some(
    (a) => !!a.lastSynced && (Date.parse(now) - Date.parse(a.lastSynced)) / 3_600_000 > 48,
  );

export function whatIf(s: Fixture, purchase: Cents) {
  const a = ats(s);
  const next = a.raw - purchase;
  const shortfall = Math.max(purchase - a.raw, 0);
  return {
    ats: Math.max(next, 0),
    perDay: floorDollars(Math.max(next, 0) / a.days),
    runway: oneDecimal((s.buckets.runway - shortfall) / s.settings.monthlySpend),
    guardrail: shortfall > 0,
  };
}

/** "Next N days" = today through today + N, inclusive. */
const withinNextDays = (s: Fixture, n: number) => (d?: ISODate | null) =>
  !!d && d >= s.today && d <= addDays(s.today, n);

export function weeklyTransfer(s: Fixture) {
  const in7 = withinNextDays(s, 7);
  const bills = sum(s.bills.filter((b) => b.confirmed && in7(b.due)).map((b) => b.amount));
  const cards = sum(
    s.accounts
      .filter((a) => a.type === 'card' && in7(a.statementDue))
      .map((c) => c.statementBalance ?? 0),
  );
  return bills + cards + ats(s).perDay * 7;
}

export function waterfall(s: Fixture, deposit: Cents) {
  let remaining = deposit;
  const take = (need: Cents) => {
    const taken = Math.min(remaining, Math.max(0, need));
    remaining -= taken;
    return taken;
  };
  const in30 = withinNextDays(s, 30);
  const tax = take(Math.round(deposit * s.settings.taxRate));
  const bills = take(
    sum(s.bills.filter((b) => b.confirmed && in30(b.due)).map((b) => b.amount)) - s.buckets.bills,
  );
  const runway = take(s.settings.runwayTarget - s.buckets.runway);
  const runwayFull = s.buckets.runway + runway >= s.settings.runwayTarget;
  const invest = runwayFull ? take(Math.round(remaining * s.settings.investShare)) : 0;
  return { tax, bills, runway, invest, free: remaining };
}

export function weekReport(s: Fixture) {
  const days = daysBetween(s.weekStart.date, nextIncome(s, s.weekStart.date).date);
  const perDayAtStart = floorDollars(s.weekStart.availableToSpend / days);
  const allowance = perDayAtStart * 7;
  return { days, perDayAtStart, allowance, over: s.thisWeek.spent - allowance };
}

export const weeklyChanges = (s: Fixture) => ({
  freeToSpend: ats(s).raw - s.weekStart.availableToSpend,
  runwayMonths: oneDecimal((s.buckets.runway - s.weekStart.runway) / s.settings.monthlySpend),
});

function calendarQuarter(d: ISODate) {
  const [y, m] = d.split('-').map(Number);
  const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
  const start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
  const nextStart =
    startMonth === 10 ? `${y + 1}-01-01` : `${y}-${String(startMonth + 3).padStart(2, '0')}-01`;
  return { start, end: addDays(nextStart, -1) };
}

/** First run: estimated spend, estimated Runway, and the unsplit preview (E3). */
export function estimate(s: Fixture) {
  const a = ats(s);
  const savings = account(s, 'savings').balance;
  const q = calendarQuarter(s.today);
  const inQuarter = (d: ISODate) => d >= q.start && d <= q.end && d <= s.today;
  const incomeTx = s.transactions.filter(
    (t) => t.category === 'Income' && t.amount > 0 && inQuarter(t.date),
  );
  const deposits = [s.pendingDeposit].filter(
    (d) => inQuarter(d.date) && !incomeTx.some((t) => t.date === d.date && t.amount === d.amount),
  );
  const income = sum(incomeTx.map((t) => t.amount)) + sum(deposits.map((d) => d.amount));
  const tax = s.settings.incomeType === 'salary' ? 0 : Math.round(s.settings.taxRate * income);
  const bills = sum(
    s.bills.filter((b) => b.confirmed && withinNextDays(s, 30)(b.due)).map((b) => b.amount),
  );
  return {
    spend: a.display,
    perDay: a.perDay,
    runwayApproxMonths: Math.round(savings / s.settings.monthlySpend),
    income,
    savings,
    preview: { tax, bills, runway: savings - tax - bills, free: 0 },
  };
}
