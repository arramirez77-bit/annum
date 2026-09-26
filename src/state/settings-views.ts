/** S3 Settings: the values each row shows. Pure, unit-tested. */
import type { Prefs } from '@/data/repo';
import { formatDollars, taxApplies, type AppData, type Cadence } from '@/domain';

import { accountRow } from './account-views';

export const CADENCE_WORD: Record<Cadence, string> = {
  weekly: 'weekly',
  biweekly: 'every 2 weeks',
  monthly: 'monthly',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weeklyReminderLabel(weekly: Prefs['reminders']['weekly']): string {
  if (!weekly) return 'Off';
  const at = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2026, 0, 4, weekly.hour, weekly.minute),
  );
  return `${WEEKDAYS[weekly.weekday]} ${at}`;
}

/** "5 months" from the target and monthly spending (rounded to a whole month). */
export const targetMonths = (data: AppData): number =>
  data.settings.monthlySpend > 0
    ? Math.round(data.settings.runwayTarget / data.settings.monthlySpend)
    : 0;

export function buildSettingsView(data: AppData, prefs: Prefs) {
  const s = data.settings;
  const months = targetMonths(data);
  return {
    showTax: taxApplies(data),
    /** Tax module toggle only makes sense with freelance income. */
    taxToggle: s.incomeType !== 'salary',
    numbers: {
      tax: `${Math.round(s.taxRate * 100)}%`,
      runway:
        s.runwayTarget > 0
          ? `${formatDollars(s.runwayTarget)}${months ? ` · ${months} months` : ''}`
          : 'Not set',
      habit: s.habitTransfer.amount
        ? `${formatDollars(s.habitTransfer.amount)} ${CADENCE_WORD[s.habitTransfer.cadence]}`
        : 'Not set',
      spend: s.monthlySpend > 0 ? `About ${formatDollars(s.monthlySpend)}` : 'Not set',
      pay: s.paySchedule
        ? `${formatDollars(s.paySchedule.amount)} ${CADENCE_WORD[s.paySchedule.cadence]}`
        : 'Not set',
    },
    /** Salary and Both have a paycheck to edit. */
    showPay: s.incomeType !== 'freelance',
    accounts: data.accounts.map(accountRow),
    connected: data.accounts.some((a) => a.source === 'demo')
      ? 'Sample bank'
      : data.accounts.some((a) => a.source === 'teller')
        ? 'Connected'
        : 'None yet',
    weekly: weeklyReminderLabel(prefs.reminders.weekly),
  };
}
