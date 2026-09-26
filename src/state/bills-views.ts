/** Bills: confirmed bills and the ones Annum noticed. Pure, unit-tested. */
import { formatDollars, formatShortDate, proposedBills, type AppData } from '@/domain';

import { CADENCE_WORD } from './settings-views';

export function buildBillsView(data: AppData) {
  const confirmed = data.bills
    .filter((b) => b.confirmed)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((b) => ({
      id: b.id,
      title: b.name,
      subtitle: `Due ${formatShortDate(b.due)} · ${CADENCE_WORD[b.cadence]}`,
      value: formatDollars(b.amount),
    }));
  const proposals = proposedBills(data.bills).map((b) => ({
    id: b.id,
    title: b.name,
    subtitle: `About ${formatDollars(b.amount)} ${CADENCE_WORD[b.cadence]} · next ${formatShortDate(b.due)}`,
  }));
  return {
    confirmed,
    proposals,
    note: 'Bills are paid from checking. Annum sets money aside for the ones due before your next income.',
    empty:
      confirmed.length === 0 && proposals.length === 0
        ? 'No bills yet. Add rent, insurance and the like, or import a few months of checking and Annum will spot them.'
        : undefined,
  };
}
