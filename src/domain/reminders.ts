/**
 * Which local notifications to schedule (docs/02 "Notifications"): the weekly review, card
 * statements, quarterly taxes, and late invoices / paydays. Pure: the app cancels everything
 * and schedules this list again after each import or settings change.
 * Copy is calm and specific; with amounts hidden on the lock screen, bodies leave them out.
 */
import { addDays } from './dates';
import { formatDollars, formatShortDate, formatWeekday } from './format';
import { availableToSpend, nextPayday } from './money';
import { taxApplies } from './waterfall';
import type { AppData, ISODate } from './types';

export interface ReminderPrefs {
  weekly: { weekday: number; hour: number; minute: number } | null;
  cardStatements: boolean;
  quarterlyTaxes: boolean;
  deposits: boolean;
}

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  /** In-app route the notification opens. */
  url: string;
  /** One-off: local date and time. */
  at?: { date: ISODate; hour: number; minute: number };
  /** Repeating every week (weekday 0 = Sunday). */
  weekly?: { weekday: number; hour: number; minute: number };
}

/** One-off reminders go out at 9 AM local time. */
export const REMINDER_HOUR = 9;

export function planReminders(
  data: AppData,
  prefs: ReminderPrefs,
  showAmounts: boolean,
  now: { date: ISODate; hour: number; minute: number },
): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  const money = (cents: number, text: string) =>
    showAmounts ? `${text} (${formatDollars(cents)})` : text;
  const future = (date: ISODate) =>
    date > now.date || (date === now.date && now.hour < REMINDER_HOUR);
  const nine = (date: ISODate) => ({ date, hour: REMINDER_HOUR, minute: 0 });

  if (prefs.weekly) {
    plan.push({
      id: 'weekly-review',
      title: 'Weekly review',
      body: 'Your weekly review is ready — about 10 minutes.',
      url: '/review',
      weekly: prefs.weekly,
    });
  }

  if (prefs.cardStatements) {
    const covered = availableToSpend(data).raw >= 0;
    for (const card of data.accounts.filter((a) => a.type === 'card')) {
      if (!card.statementDue || !(card.statementBalance && card.statementBalance > 0)) continue;
      const on = addDays(card.statementDue, -2);
      if (!future(on)) continue;
      plan.push({
        id: `statement-${card.id}`,
        title: `${card.name} statement`,
        body: `${money(card.statementBalance, `${card.name} statement`)} is due ${formatWeekday(card.statementDue)}. ${covered ? 'You’re covered.' : 'Open Annum to see what you can move.'}`,
        url: '/',
        at: nine(on),
      });
    }
  }

  if (prefs.quarterlyTaxes && taxApplies(data) && data.taxYear) {
    const due = data.taxYear.nextQuarterlyDue;
    const on = addDays(due, -7);
    if (future(on)) {
      plan.push({
        id: `quarterly-${due}`,
        title: 'Quarterly taxes',
        body: `Estimated taxes are due ${formatShortDate(due)}.${showAmounts ? ` Your Tax bucket holds ${formatDollars(data.buckets.tax)}.` : ''}`,
        url: '/money/taxes',
        at: nine(on),
      });
    }
  }

  if (prefs.deposits) {
    for (const income of data.expectedIncome.filter((i) => !i.received)) {
      const on = addDays(income.date, 1);
      if (!future(on)) continue;
      plan.push({
        id: `late-${income.id}`,
        title: `${income.source} invoice`,
        body: `It hasn’t shown up yet. Annum plans as if it lands ${formatShortDate(addDays(now.date > income.date ? now.date : income.date, data.lateAssumeDays))}. Import this week’s transactions if it came in.`,
        url: '/',
        at: nine(on),
      });
    }
    const pay = data.settings.paySchedule;
    if (pay && data.settings.incomeType !== 'freelance') {
      const next = nextPayday(pay, now.date);
      if (future(next)) {
        plan.push({
          id: `payday-${next}`,
          title: 'Payday',
          body: `${showAmounts ? `${formatDollars(pay.amount)} should land today. ` : ''}Import your transactions to see the new number.`,
          url: '/',
          at: nine(next),
        });
      }
    }
  }
  return plan;
}
