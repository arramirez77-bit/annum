/** Status rules — docs/03 "Status rules". */
import { availableToSpend, type AvailableToSpend } from './money';
import type { Account, AppData, Cents, TodayStatus } from './types';

/** Below this per-day amount, Today shows a heads-up. */
export const PER_DAY_FLOOR: Cents = 2000;
/** An account not synced for longer than this is stale. */
export const STALE_AFTER_HOURS = 48;

export type HeadsUpCause =
  | { kind: 'statement-before-income'; name: string; amount: Cents }
  | { kind: 'low-per-day'; perDay: Cents }
  | { kind: 'late-income'; source?: string; daysLate: number };

/** Every reason Today would show a heads-up, most important first. Empty = on track. */
export function headsUpCauses(
  data: AppData,
  ats: AvailableToSpend = availableToSpend(data),
): HeadsUpCause[] {
  const causes: HeadsUpCause[] = [];
  if (ats.nextIncome.kind === 'late') {
    causes.push({
      kind: 'late-income',
      source: ats.nextIncome.source,
      daysLate: ats.nextIncome.daysLate ?? 0,
    });
  }
  const statement = ats.obligations.find((o) => o.kind === 'statement' && ats.raw < o.amount);
  if (statement) {
    causes.push({
      kind: 'statement-before-income',
      name: statement.name,
      amount: statement.amount,
    });
  }
  if (ats.perDay < PER_DAY_FLOOR) causes.push({ kind: 'low-per-day', perDay: ats.perDay });
  return causes;
}

export function todayStatus(
  data: AppData,
  ats: AvailableToSpend = availableToSpend(data),
): TodayStatus {
  if (data.settings.isEstimate) return 'estimate';
  return headsUpCauses(data, ats).length > 0 ? 'heads-up' : 'on-track';
}

/** Accounts not synced for more than 48 hours. Manually entered accounts are never stale. */
/**
 * Imported accounts are refreshed by hand, about weekly, so they count as out of date after a
 * week instead of 48 hours (a note every few days would teach people to ignore it).
 */
export const IMPORT_STALE_AFTER_HOURS = 7 * 24;

export function staleAccounts(data: AppData, now: Date): Account[] {
  return data.accounts.filter(
    (a) =>
      a.source !== 'manual' &&
      !!a.lastSynced &&
      (now.getTime() - Date.parse(a.lastSynced)) / 3_600_000 >
        (a.source === 'import' ? IMPORT_STALE_AFTER_HOURS : STALE_AFTER_HOURS),
  );
}

/** Staleness never changes the status; it adds the stale note and "about". */
export const isStale = (data: AppData, now: Date): boolean => staleAccounts(data, now).length > 0;
