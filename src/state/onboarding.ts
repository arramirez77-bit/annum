/**
 * First-run answers (O1–O4c), kept in memory until the last step saves them. Quitting halfway
 * starts onboarding over, which takes about 3 minutes.
 */
import { create } from 'zustand';

import type { DemoConnection } from '@/data/demo';
import {
  learnedMonthlySpend,
  localISODate,
  mergeImport,
  type Account,
  type Bill,
  type Cents,
  type ExpectedIncome,
  type IncomeType,
  type PaySchedule,
  type Transaction,
} from '@/domain';

import { localDateTime, type ImportOutcome, type ImportPlan } from './store';

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
  /** S11 during setup: the file's account and transactions join the draft. */
  importStatement: (plan: ImportPlan) => ImportOutcome;
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

let draftId = 1;

export const useOnboarding = create<OnboardingState>((set, get) => ({
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
  importStatement: (plan) => {
    const s = get();
    const account: Account = {
      ...plan.account,
      source: 'import',
      lastSynced: localDateTime(new Date()),
    };
    const accounts = s.accounts.some((a) => a.id === account.id)
      ? s.accounts.map((a) => (a.id === account.id ? account : a))
      : [...s.accounts.filter((a) => a.balance !== 0 || a.source !== 'manual'), account];
    const merge = mergeImport(
      s.transactions,
      plan.transactions,
      account.id,
      [],
      () => `txn-draft-${draftId++}`,
    );
    const today = localISODate(new Date());
    set({
      path: 'import',
      accounts,
      transactions: merge.transactions,
      monthlySpend: s.monthlySpend ?? learnedMonthlySpend(merge.transactions, today) ?? null,
    });
    return {
      added: merge.added.length,
      duplicates: merge.duplicates,
      ...(merge.range ? { range: merge.range } : {}),
      received: [],
      proposals: 0,
    };
  },
  setLock: (lock) => set({ lock }),
  setReminders: (reminders) => set({ reminders }),
  clear: () => set(blank),
}));
