/**
 * First-run answers (O1–O4c), kept in memory until the last step saves them. Quitting halfway
 * starts onboarding over, which takes about 3 minutes.
 */
import { create } from 'zustand';

import type { DemoConnection } from '@/data/demo';
import type {
  Account,
  Bill,
  Cents,
  ExpectedIncome,
  IncomeType,
  PaySchedule,
  Transaction,
} from '@/domain';

export type ConnectPath = 'demo' | 'manual' | 'import';

export interface OnboardingDraft {
  incomeType: IncomeType | null;
  paySchedule: PaySchedule | null;
  /** The next invoice, if the user knows it. */
  invoice: ExpectedIncome | null;
  path: ConnectPath | null;
  accounts: Account[];
  transactions: Transaction[];
  bills: Bill[];
  monthlySpend: Cents | null;
  lock: boolean;
  reminders: boolean;
}

interface OnboardingState extends OnboardingDraft {
  setIncomeType: (incomeType: IncomeType) => void;
  setPaySchedule: (pay: PaySchedule | null) => void;
  setInvoice: (invoice: ExpectedIncome | null) => void;
  connectDemo: (connection: DemoConnection) => void;
  enterByHand: () => void;
  setAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  setMonthlySpend: (amount: Cents | null) => void;
  setLock: (on: boolean) => void;
  setReminders: (on: boolean) => void;
  clear: () => void;
}

/** Manual path: the two accounts every plan needs, balances still to fill in. */
export const MANUAL_ACCOUNTS: Account[] = [
  {
    id: 'checking',
    name: 'Checking',
    type: 'checking',
    balance: 0,
    source: 'manual',
    status: 'ok',
  },
  { id: 'savings', name: 'Savings', type: 'savings', balance: 0, source: 'manual', status: 'ok' },
];

const blank: OnboardingDraft = {
  incomeType: null,
  paySchedule: null,
  invoice: null,
  path: null,
  accounts: [],
  transactions: [],
  bills: [],
  monthlySpend: null,
  lock: false,
  reminders: false,
};

export const useOnboarding = create<OnboardingState>((set) => ({
  ...blank,
  setIncomeType: (incomeType) => set({ incomeType }),
  setPaySchedule: (paySchedule) => set({ paySchedule }),
  setInvoice: (invoice) => set({ invoice }),
  connectDemo: (c) =>
    set({
      path: 'demo',
      accounts: c.accounts,
      transactions: c.transactions,
      bills: c.bills,
      monthlySpend: c.monthlySpend,
    }),
  enterByHand: () =>
    set((s) => ({
      path: 'manual',
      accounts: s.path === 'manual' ? s.accounts : MANUAL_ACCOUNTS,
      transactions: [],
      bills: [],
    })),
  setAccount: (account) =>
    set((s) => ({
      accounts: s.accounts.some((a) => a.id === account.id)
        ? s.accounts.map((a) => (a.id === account.id ? account : a))
        : [...s.accounts, account],
    })),
  removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
  setMonthlySpend: (monthlySpend) => set({ monthlySpend }),
  setLock: (lock) => set({ lock }),
  setReminders: (reminders) => set({ reminders }),
  clear: () => set(blank),
}));
