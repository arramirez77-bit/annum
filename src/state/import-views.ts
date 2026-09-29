/** S11 Import a file: the sentences each step shows. Pure, unit-tested. */
import type { LastImport } from '@/data/repo';
import {
  formatDollars,
  formatShortDate,
  formatSignedCents,
  mergeImport,
  tidyMerchant,
  type Account,
  type AppData,
  type ImportedTransaction,
} from '@/domain';

import type { ImportOutcome } from './store';

const range = (from?: string, to?: string) =>
  from && to
    ? from === to
      ? formatShortDate(from)
      : `${formatShortDate(from)} – ${formatShortDate(to)}`
    : '';

/** The last-import row (Figma S11): "Woodgrove checking", "Aug 1 to Sep 22 · 214 new, 12 skipped", "Added". */
export function lastImportRow(last: LastImport | null) {
  if (!last) return undefined;
  const dates =
    last.from && last.to
      ? last.from === last.to
        ? formatShortDate(last.from)
        : `${formatShortDate(last.from)} to ${formatShortDate(last.to)}`
      : undefined;
  return {
    title: last.account,
    subtitle: [dates, `${last.added} new${last.duplicates ? `, ${last.duplicates} skipped` : ''}`]
      .filter(Boolean)
      .join(' · '),
    value: 'Added',
  };
}

export function buildImportPreview(
  data: AppData,
  incoming: readonly ImportedTransaction[],
  accountId: string | null,
) {
  const dates = incoming.map((t) => t.date).sort();
  const dry = accountId
    ? mergeImport(data.transactions, incoming, accountId, [], () => 'preview')
    : null;
  const fresh = dry ? dry.added.length : incoming.length;
  return {
    count: incoming.length,
    sentence: incoming.length
      ? `${incoming.length} ${incoming.length === 1 ? 'transaction' : 'transactions'} from ${range(dates[0], dates[dates.length - 1])}.${dry && dry.duplicates ? ` ${dry.duplicates} ${dry.duplicates === 1 ? 'is' : 'are'} already in Annum and will be skipped.` : ''}`
      : 'This file has no transactions.',
    samples: incoming.slice(0, 3).map((t) => ({
      title: tidyMerchant(t.merchant),
      subtitle: `${formatShortDate(t.date)} · ${t.amount < 0 ? 'money out' : 'money in'}`,
      value: formatSignedCents(t.amount),
    })),
    primary: fresh
      ? `Import ${fresh} ${fresh === 1 ? 'transaction' : 'transactions'}`
      : 'Nothing new to import',
    canImport: fresh > 0,
  };
}

export function buildImportResult(outcome: ImportOutcome, account: Account) {
  const lines = [
    outcome.added
      ? `Added ${outcome.added} new ${outcome.added === 1 ? 'transaction' : 'transactions'} to ${account.name}${outcome.range ? ` (${range(outcome.range.from, outcome.range.to)})` : ''}.`
      : `Nothing new for ${account.name}.`,
    outcome.duplicates ? `Skipped ${outcome.duplicates} already in Annum.` : undefined,
    ...outcome.received.map(
      (r) => `${r.source}’s ${formatDollars(r.amount)} arrived, so Annum stopped waiting for it.`,
    ),
    outcome.proposals
      ? `Annum noticed ${outcome.proposals} ${outcome.proposals === 1 ? 'payment that looks like a bill' : 'payments that look like bills'}.`
      : undefined,
  ].filter((l): l is string => !!l);
  return {
    title: outcome.added ? 'Imported' : 'Already up to date',
    lines,
    splitDepositId: outcome.depositId,
    showBills: outcome.proposals > 0,
  };
}
