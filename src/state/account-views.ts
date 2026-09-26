/** Account rows (O4 Accounts, S10, Settings). Pure, unit-tested. */
import { formatDollars, formatShortDate, type Account } from '@/domain';

export const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'card', label: 'Credit card' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'loan', label: 'Loan' },
];

export const owes = (a: Account) => a.type === 'card' || a.type === 'loan';

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function accountRow(a: Account) {
  const byHand = a.source === 'manual';
  const empty = byHand && a.balance === 0;
  const subtitle = empty
    ? 'Tap to add balance'
    : byHand
      ? a.enteredOn
        ? `Entered by hand · ${formatShortDate(a.enteredOn)}`
        : 'Entered by hand'
      : a.source === 'demo'
        ? `Sample bank · updated ${a.lastSynced ? time.format(new Date(a.lastSynced)) : ''}`.trim()
        : a.source === 'import'
          ? a.lastSynced
            ? `Imported ${formatShortDate(a.lastSynced.slice(0, 10))}`
            : 'From a file'
          : a.lastSynced
            ? `Updated ${time.format(new Date(a.lastSynced))}`
            : 'Connected';
  return {
    id: a.id,
    title: a.name,
    subtitle,
    value: empty
      ? undefined
      : owes(a)
        ? `${formatDollars(a.balance)} owed`
        : formatDollars(a.balance),
    editable: byHand || a.source === 'import',
  };
}
