/** Account rows (O4 Accounts, S10, Settings). Pure, unit-tested. */
import { formatDollars, type Account } from '@/domain';

export const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'card', label: 'Credit card' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'loan', label: 'Loan' },
];

export const owes = (a: Account) => a.type === 'card' || a.type === 'loan';

/** O4 rows (Figma 62:557): "Checking · connected", "Loan · tap to add balance" (value "Add"). */
export function accountRow(a: Account) {
  const type = ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? 'Account';
  const byHand = a.source === 'manual';
  const empty = byHand && a.balance === 0;
  const how = empty
    ? 'tap to add balance'
    : byHand
      ? 'entered by hand'
      : a.source === 'import'
        ? 'from a file'
        : 'connected';
  return {
    id: a.id,
    title: a.name,
    subtitle: `${type} · ${how}`,
    value: empty ? 'Add' : formatDollars(a.balance),
    editable: byHand || a.source === 'import',
  };
}

/** "Woodgrove", "Woodgrove and Contoso", "Woodgrove, Contoso and Tailspin". */
export function joinNames(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? '';
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

/** O4 subtitle after a bank connects (Figma 62:557). */
export function accountsFoundNote(institutions: string[]): string {
  const from = institutions.length > 0 ? `From ${joinNames(institutions)}. ` : '';
  return `${from}Investment accounts and loans usually don’t connect, so add those by hand.`;
}
