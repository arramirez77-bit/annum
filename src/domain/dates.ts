/**
 * Local calendar dates as 'YYYY-MM-DD' strings. All arithmetic is on the calendar
 * (year/month/day), never on timestamps, so daylight-saving changes and the time of
 * day can't shift a count by one.
 */
import type { ISODate } from './types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parts(d: ISODate): [number, number, number] {
  const m = ISO_RE.exec(d);
  if (!m) throw new Error(`Not a calendar date: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const pad = (n: number) => String(n).padStart(2, '0');
const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);
const toUTC = (d: ISODate) => {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
};

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  return fromUTC(toUTC(value)) === value;
}

/** The local calendar date of a moment, in the device's time zone. */
export function localISODate(moment: Date): ISODate {
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** Same day n months later, clamped to the month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m, day] = parts(d);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** Calendar days from `from` to `to` (Sep 23 → Oct 13 = 20). Negative if `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** [start, end): includes start, excludes end. */
export const inHalfOpen = (
  d: ISODate | null | undefined,
  start: ISODate,
  end: ISODate,
): d is ISODate => !!d && d >= start && d < end;

/** [start, end]: includes both ends. */
export const inClosed = (
  d: ISODate | null | undefined,
  start: ISODate,
  end: ISODate,
): d is ISODate => !!d && d >= start && d <= end;

/** "Next N days" = today through today + N, inclusive (docs/03 Date windows). */
export const inNextDays = (
  d: ISODate | null | undefined,
  today: ISODate,
  n: number,
): d is ISODate => inClosed(d, today, addDays(today, n));

export function calendarQuarter(d: ISODate): { start: ISODate; end: ISODate } {
  const [y, m] = parts(d);
  const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
  const start = `${y}-${pad(startMonth)}-01`;
  return { start, end: addDays(addMonths(start, 3), -1) };
}

export const minDate = (a: ISODate, b: ISODate): ISODate => (a <= b ? a : b);
