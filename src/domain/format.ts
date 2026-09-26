/** Display formatting at the edge (Intl.NumberFormat). Pure; no rounding of the underlying cents. */
import type { Cents, ISODate } from './types';

const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const withCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const weekdayDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "$1,240" — whole dollars, rounded down (never overstates what's spendable). */
export const formatDollars = (cents: Cents): string =>
  cents < 0
    ? `−${wholeDollars.format(Math.floor(-cents / 100))}`
    : wholeDollars.format(Math.floor(cents / 100));

/** "$84.12" / "−$84.12" — for transaction amounts. */
export const formatCents = (cents: Cents): string =>
  cents < 0 ? `−${withCents.format(-cents / 100)}` : withCents.format(cents / 100);

/** "+$5,000.00" / "−$20.00" — signed transaction amounts. */
export const formatSignedCents = (cents: Cents): string =>
  cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);

/** "$15k", "$12.5k" — compact thousands for targets. */
export function formatCompactThousands(cents: Cents): string {
  const k = Math.round(cents / 10_000) / 10; // thousands, one decimal
  return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** "Down $400" / "Up $400" / "No change". */
export const formatDollarChange = (cents: Cents): string =>
  cents === 0 ? 'No change' : `${cents > 0 ? 'Up' : 'Down'} ${formatDollars(Math.abs(cents))}`;

/** "4.2" — months, one decimal. */
export const formatMonths = (months: number): string => months.toFixed(1);

/** "Up 0.2" / "Down 0.3" / "No change" — a change in months. */
export const formatMonthsChange = (months: number): string =>
  months === 0 ? 'No change' : `${months > 0 ? 'Up' : 'Down'} ${Math.abs(months).toFixed(1)}`;

/** "Oct 13". */
export const formatShortDate = (d: ISODate): string => shortDate.format(new Date(`${d}T00:00:00Z`));

/** "Sunday, Sep 27". */
export const formatWeekdayDate = (d: ISODate): string =>
  weekdayDate.format(new Date(`${d}T00:00:00Z`));
