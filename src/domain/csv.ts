/**
 * CSV bank exports (S11): parse, guess which column is which, and turn rows into imported
 * transactions. Banks differ, so a mapping the user confirms is remembered per header row.
 */
import type { Cents, ISODate } from './types';

export interface ImportedTransaction {
  date: ISODate;
  merchant: string;
  /** Negative = money out. */
  amount: Cents;
  /** The bank's own id (OFX FITID), when the file has one. */
  externalId?: string;
}

/** Which column holds what. Either one signed `amount`, or separate `debit` / `credit`. */
export interface CsvMapping {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  /** Some exports (often cards) list money out as positive: flip the sign. */
  outflowPositive: boolean;
  dateOrder: 'mdy' | 'dmy' | 'ymd';
}

/** RFC 4180-style: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

const HEADER = {
  date: [/^(transaction|trans\.?) date$/, /^date$/, /^(posted|posting|post) date$/, /date/],
  description: [
    /^description$/,
    /^merchant/,
    /^payee$/,
    /^(name|details)$/,
    /^memo$/,
    /description|payee/,
  ],
  amount: [/^amount$/, /^(transaction )?amount( \(usd\))?$/, /amount/],
  debit: [/^debit( amount)?$/, /^withdrawals?$/, /money out/, /^charges?$/],
  // "Payment" is left out: it's money out on checking exports and money in on card exports.
  credit: [/^credit( amount)?$/, /^deposits?$/, /money in/],
};

const findColumn = (header: string[], patterns: RegExp[], taken: number[]): number | undefined => {
  const cells = header.map((h) => h.toLowerCase().trim());
  for (const p of patterns) {
    const i = cells.findIndex((c, idx) => !taken.includes(idx) && p.test(c));
    if (i >= 0) return i;
  }
  return undefined;
};

/** The header row: the first row that names a date and an amount (or debit/credit) column. */
export function findHeader(rows: string[][]): number {
  return rows.findIndex((r) => {
    const cells = r.map((c) => c.toLowerCase());
    return (
      cells.some((c) => c.includes('date')) &&
      cells.some((c) => /amount|debit|credit|withdraw|deposit/.test(c))
    );
  });
}

/** Guess the date order from the sample: a first part over 12 means day-first. */
export function guessDateOrder(samples: string[]): CsvMapping['dateOrder'] {
  if (samples.some((s) => /^\d{4}[-/.]/.test(s))) return 'ymd';
  if (samples.some((s) => Number(s.split(/[-/.]/)[0]) > 12)) return 'dmy';
  return 'mdy';
}

/** A first guess at the mapping, or null when there's no date or amount column. */
export function detectMapping(header: string[], sample: string[][]): CsvMapping | null {
  const taken: number[] = [];
  const pick = (patterns: RegExp[]) => {
    const i = findColumn(header, patterns, taken);
    if (i !== undefined) taken.push(i);
    return i;
  };
  const date = pick(HEADER.date);
  const amount = pick(HEADER.amount);
  const debit = amount === undefined ? pick(HEADER.debit) : undefined;
  const credit = amount === undefined ? pick(HEADER.credit) : undefined;
  const description = pick(HEADER.description);
  if (date === undefined || description === undefined) return null;
  // Money out has to be readable; a file with only a money-in column needs the user's eye.
  if (amount === undefined && debit === undefined) return null;
  return {
    date,
    description,
    ...(amount !== undefined ? { amount } : {}),
    ...(debit !== undefined ? { debit } : {}),
    ...(credit !== undefined ? { credit } : {}),
    outflowPositive: false,
    dateOrder: guessDateOrder(sample.map((r) => r[date] ?? '')),
  };
}

/** "$1,234.56", "-12.34", "(12.34)", "12.34-", "12.34 DR" → cents (DR and parentheses are negative). */
export function parseAmount(text: string): Cents | null {
  const t = text.trim();
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t) || /-$/.test(t) || /^-/.test(t) || /\bDR$/i.test(t);
  const digits = t.replace(/[()$€£,\s]|CR$|DR$/gi, '').replace(/-/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const [whole, frac = ''] = digits.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return negative ? -cents : cents;
}

/** "9/23/2026", "2026-09-23", "23.09.26" → 2026-09-23, using the file's date order. */
export function parseDate(text: string, order: CsvMapping['dateOrder']): ISODate | null {
  const parts = text
    .trim()
    .split(/[-/.\s]/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
  let [y, m, d] =
    order === 'ymd'
      ? parts
      : order === 'dmy'
        ? [parts[2], parts[1], parts[0]]
        : [parts[2], parts[0], parts[1]];
  if (y.length === 2) y = `20${y}`;
  const month = Number(m);
  const day = Number(d);
  if (y.length !== 4 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  m = String(month).padStart(2, '0');
  d = String(day).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  // Reject impossible days (Feb 30) by round-tripping through UTC.
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

export interface CsvResult {
  transactions: ImportedTransaction[];
  /** Rows that couldn't be read (no date or amount). */
  skipped: number;
}

export function csvTransactions(rows: string[][], mapping: CsvMapping): CsvResult {
  const transactions: ImportedTransaction[] = [];
  let skipped = 0;
  for (const r of rows) {
    const date = parseDate(r[mapping.date] ?? '', mapping.dateOrder);
    let amount: Cents | null = null;
    if (mapping.amount !== undefined) amount = parseAmount(r[mapping.amount] ?? '');
    else {
      const out = mapping.debit !== undefined ? parseAmount(r[mapping.debit] ?? '') : null;
      const inn = mapping.credit !== undefined ? parseAmount(r[mapping.credit] ?? '') : null;
      if (out !== null && out !== 0) amount = -Math.abs(out);
      else if (inn !== null) amount = Math.abs(inn);
    }
    const merchant = (r[mapping.description] ?? '').replace(/\s+/g, ' ').trim();
    if (!date || amount === null || !merchant) {
      skipped++;
      continue;
    }
    transactions.push({ date, merchant, amount: mapping.outflowPositive ? -amount : amount });
  }
  return { transactions, skipped };
}

/** Remembered mappings are keyed by the file's header row (same bank, same export → same key). */
export const headerKey = (header: string[]): string =>
  header.map((h) => h.toLowerCase().trim()).join('|');
