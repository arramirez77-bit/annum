/** S11: recognise a downloaded bank file (OFX/QFX or CSV) and read what's in it. */
import {
  csvTransactions,
  detectMapping,
  findHeader,
  headerKey,
  parseCsv,
  type CsvMapping,
  type ImportedTransaction,
} from './csv';
import { isOfx, parseOfx, type OfxStatement } from './ofx';
import type { ISODate } from './types';

export type BankFile =
  | { kind: 'ofx'; statements: OfxStatement[] }
  | {
      kind: 'csv';
      header: string[];
      rows: string[][];
      /** Remembered for this bank's header, else guessed; null = the user picks columns. */
      mapping: CsvMapping | null;
      remembered: boolean;
      key: string;
    }
  | { kind: 'unreadable' }
  | { kind: 'empty' };

export function readBankFile(text: string, remembered: Record<string, CsvMapping>): BankFile {
  if (isOfx(text)) {
    const statements = parseOfx(text).filter(
      (s) => s.transactions.length > 0 || s.balance !== undefined,
    );
    return statements.length ? { kind: 'ofx', statements } : { kind: 'empty' };
  }
  const all = parseCsv(text);
  const h = findHeader(all);
  if (h < 0) return all.length ? { kind: 'unreadable' } : { kind: 'empty' };
  const header = all[h];
  const rows = all.slice(h + 1);
  if (!rows.length) return { kind: 'empty' };
  const key = headerKey(header);
  const saved = remembered[key];
  return {
    kind: 'csv',
    header,
    rows,
    mapping: saved ?? detectMapping(header, rows),
    remembered: !!saved,
    key,
  };
}

/**
 * A CSV's "Balance" column, from its newest row: a first guess at the balance today. Files are
 * newest-first or oldest-first; the dates of the first and last rows tell which.
 */
export function csvBalance(
  file: Extract<BankFile, { kind: 'csv' }>,
  mapping: CsvMapping,
): { amount: number; date: ISODate } | undefined {
  const col = file.header.findIndex((h) => /^(running )?balance$/i.test(h.trim()));
  if (col < 0) return undefined;
  const dated = file.rows
    .map((row) => ({ row, date: csvTransactions([row], mapping).transactions[0]?.date }))
    .filter((x) => !!x.date);
  if (!dated.length) return undefined;
  const newestFirst = (dated[0].date ?? '') >= (dated[dated.length - 1].date ?? '');
  const { row, date } = newestFirst ? dated[0] : dated[dated.length - 1];
  const value = (row[col] ?? '').replace(/[$,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(value) && date
    ? { amount: Math.round(Number(value) * 100), date }
    : undefined;
}

/** The file's transactions with a mapping (CSV) or as-is (OFX statement). */
export function fileTransactions(
  file: BankFile,
  mapping: CsvMapping | null,
  statement = 0,
): ImportedTransaction[] {
  if (file.kind === 'ofx') return file.statements[statement]?.transactions ?? [];
  if (file.kind === 'csv' && mapping) return csvTransactions(file.rows, mapping).transactions;
  return [];
}
