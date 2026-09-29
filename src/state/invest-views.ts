/**
 * S6 Invest handoff and S7 waited-on purchase: the words each shows. Pure, unit-tested.
 * Data rules: Andy, 2026-09-28 (PROGRESS decisions log).
 */
import type { BankConnection } from '@/data/repo';
import {
  formatDollars,
  formatMonths,
  formatShortDate,
  runwayMonths,
  whatIf,
  type AppData,
  type DeferredPurchase,
  type InvestMove,
} from '@/domain';

const targetMonthsOf = (data: AppData) =>
  data.settings.monthlySpend > 0
    ? Math.round(data.settings.runwayTarget / data.settings.monthlySpend)
    : 0;

/** Where invested money goes: the first brokerage account, if Annum tracks one. */
export function investDestination(data: AppData) {
  const account = data.accounts.find((a) => a.type === 'brokerage');
  return account
    ? { name: account.name, accountId: account.id, byHand: account.source === 'manual' }
    : { name: 'your investment account', accountId: undefined, byHand: false };
}

/** Where it leaves from: the savings account's bank ("Woodgrove"), else the account's name. */
export function savingsSource(data: AppData, connections: readonly BankConnection[]): string {
  const savings = data.accounts.find((a) => a.type === 'savings');
  if (!savings) return 'savings';
  const bank = savings.itemId && connections.find((c) => c.itemId === savings.itemId);
  return bank ? bank.institution : savings.name;
}

/** S6 (Figma 65:829). `afterDeposit`: opened right after a split filled Runway. */
export function buildInvestView(data: AppData, afterDeposit: boolean) {
  const amount = data.buckets.invest;
  const target = data.settings.runwayTarget;
  const full = target > 0 && data.buckets.runway >= target;
  const months = targetMonthsOf(data);
  const destination = investDestination(data);
  return {
    empty: amount <= 0,
    label: full ? 'Runway is full' : 'Ready to invest',
    amount: formatDollars(amount),
    sentence: full
      ? `is ready to invest. Your savings now cover ${months} months, which was your target.`
      : 'is ready to invest.',
    rows: [
      {
        bucket: 'runway' as const,
        title: 'Runway',
        subtitle: full
          ? afterDeposit
            ? 'Hit its target with this deposit'
            : `At its ${months}-month target`
          : `${formatMonths(runwayMonths(data))} months · target ${months} months`,
        value: formatDollars(data.buckets.runway),
      },
      {
        bucket: 'invest' as const,
        title: 'Invest',
        subtitle: 'Waiting to be moved',
        value: formatDollars(amount),
      },
    ],
    note: `Annum doesn’t pick investments. Move it in ${destination.name}, then mark it here so your buckets stay accurate.`,
    primary: 'I moved it',
    quiet: 'Remind me tomorrow',
  };
}

/** S6 after "I moved it" (no frame: the log line, the pending rule, and the one-tap add). */
export function buildMovedView(data: AppData, move: InvestMove) {
  const account = move.toAccountId
    ? data.accounts.find((a) => a.id === move.toAccountId)
    : undefined;
  const byHand = account?.source === 'manual';
  return {
    title: `Moved ${formatDollars(move.amount)} to ${move.to}`,
    line: `Pending until it leaves ${move.from}. Annum marks it done when your savings balance shows it gone.`,
    add: byHand ? `Add ${formatDollars(move.amount)} to ${move.to}` : undefined,
    added: account ? `Added. ${move.to} now shows ${formatDollars(account.balance)}.` : undefined,
  };
}

/** Money: each pending move, with its date, until savings show it gone. */
export const movingRows = (moves: readonly InvestMove[]) =>
  moves
    .filter((m) => m.status === 'pending')
    .map((m) => ({
      id: m.id,
      title: `Moved ${formatDollars(m.amount)} to ${m.to}`,
      subtitle: `${formatShortDate(m.markedOn)} · Pending until it leaves ${m.from}`,
      value: formatDollars(m.amount),
    }));

/** S7 (Figma 65:864). */
export function buildDeferredView(data: AppData, purchase: DeferredPurchase) {
  const w = whatIf(data, purchase.amount);
  const fits = !w.guardrail;
  const when = purchase.createdOn ? `On ${formatShortDate(purchase.createdOn)} you` : 'Earlier you';
  const runwayNow = runwayMonths(data);
  return {
    title: 'Your invoice landed',
    sentence: `${when} waited on a ${formatDollars(purchase.amount)} purchase. ${fits ? 'It fits now.' : 'It would still dip into Runway.'}`,
    rows: [
      {
        title: 'If you buy it now',
        subtitle: fits
          ? 'Comes out of Free'
          : `${formatDollars(w.shortfall)} of it comes out of Runway`,
        value: formatDollars(purchase.amount),
      },
      {
        title: 'Runway after',
        subtitle: w.shortfall > 0 ? `Down from ${formatMonths(runwayNow)} months` : 'Unchanged',
        value: `${formatMonths(w.runwayMonths)} months`,
      },
    ],
    waitUntil: w.waitUntil,
    primary: 'Buy it',
    secondary: 'Wait again',
    quiet: 'I don’t need it',
  };
}
