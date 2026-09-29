/**
 * App state (Zustand). Real mode loads from the encrypted database and saves every change
 * (state/session.ts); demo mode (development builds) loads the fixtures and saves nothing.
 */
import { create } from 'zustand';

import { demoScenario, type ScenarioName } from '@/data/demo';
import { DEFAULT_PREFS, type BankConnection, type PendingTransfer, type Prefs } from '@/data/repo';
import {
  applyImport,
  applyTaxChanges,
  confirmSplit,
  currentDeposit,
  mergeBankAccounts,
  mergeBankChanges,
  mergeImport,
  proposeBills,
  localISODate,
  markInvestMoved,
  newAppData,
  settleInvestMoves,
  ruleFromCorrection,
  toTag,
  normalizeMerchant,
  upsertRule,
  weekStartSnapshot,
  withDerived,
  type Account,
  type AppData,
  type BankChanges,
  type Bill,
  type Cadence,
  type CsvMapping,
  type CategoryRule,
  type Cents,
  type DeferredPurchase,
  type ExpectedIncome,
  type ImportedTransaction,
  type InvestMove,
  type ISODate,
  type Settings,
  type Split,
  type Transaction,
} from '@/domain';
import { haptic } from '@/services/haptics';

import { depositsWith, lastReviewDate, type Persisted } from './persist';

export type { PendingTransfer };

/**
 * booting: deciding what to show · onboarding: first run · locked: Face ID (S5) ·
 * ready: the app · blocked: the data can't be opened on this phone (calm recovery screen).
 */
export type Phase = 'booting' | 'onboarding' | 'locked' | 'ready' | 'blocked';

/** S11: one file's statement, ready to add to an account (existing or new). */
export interface ImportPlan {
  account: Account;
  transactions: ImportedTransaction[];
}

export interface ImportOutcome {
  added: number;
  duplicates: number;
  range?: { from: ISODate; to: ISODate };
  /** Expected income that arrived with this file. */
  received: { source: string; amount: Cents }[];
  /** A landed invoice to split (Money → Split it). */
  depositId?: string;
  /** New bills Annum noticed. */
  proposals: number;
}
export type Blocked = 'key-missing' | 'newer' | 'cant-open';

/** One connection's sync, ready to apply (state/bank.ts fetches it). */
export interface BankSync {
  accounts: Omit<Account, 'id'>[];
  changes: BankChanges;
  /** First sync of a connection: history before this date arrives already reviewed. */
  reviewedBefore?: ISODate;
}

export interface BankSyncOutcome {
  added: number;
  removed: number;
  /** A landed invoice to split (Money → Split it). */
  depositId?: string;
  proposals: number;
}

export interface AppState extends Persisted {
  mode: 'demo' | 'real';
  phase: Phase;
  blocked: Blocked | null;
  /** Real data is in memory (a lock after 5 minutes keeps it; a cold start doesn't have it yet). */
  loaded: boolean;
  scenario: ScenarioName;
  /** Transactions as they were when tagging started (to tell corrections from suggestions). */
  tagBaseline: Transaction[] | null;
  lastReviewDate: ISODate | null;
  lockEnabled: boolean;
  /** The last save didn't reach the database; the next change tries again. */
  saveProblem: boolean;

  setPhase: (phase: Phase, blocked?: Blocked | null) => void;
  hydrate: (persisted: Persisted, lockEnabled: boolean) => void;
  /** After Delete everything: empty, back to the first-run screens. */
  reset: () => void;
  setScenario: (name: ScenarioName) => void;
  setToday: (today: ISODate) => void;
  setLockEnabled: (on: boolean) => void;
  setSaveProblem: (problem: boolean) => void;

  deferPurchase: (amount: Cents, waitUntil: ISODate) => DeferredPurchase;
  /** S7: bought it, or don't need it any more. */
  resolveDeferred: (id: string, status: 'bought' | 'dropped') => void;
  /** S7 "Wait again": until the next income date. */
  waitAgain: (id: string, waitUntil: ISODate) => void;
  /** S6 "I moved it": Invest goes to $0 and the move is logged as pending. */
  markInvestMoved: (where: Pick<InvestMove, 'to' | 'toAccountId' | 'from'>) => InvestMove | null;
  /** S6, accounts entered by hand only, on a tap: add the moved amount to that balance. */
  addToBalance: (accountId: string, amount: Cents) => void;
  saveReviewStep: (step: number) => void;
  chooseCategory: (transactionId: string, category: string) => void;
  toggleTax: (transactionId: string) => void;
  finishTagging: () => void;
  setHabit: (amount: Cents, cadence: Cadence) => void;
  markTransferMoved: (amount: Cents) => void;
  completeReview: () => void;
  setSplitSettings: (taxRate: number, runwayTarget: Cents) => void;
  confirmDeposit: (split: Split, landed: boolean) => void;

  /** S9: change one transaction (category, work expense, tax category). */
  editTransaction: (
    id: string,
    change: Partial<Pick<Transaction, 'category' | 'tax' | 'taxCategory'>>,
  ) => void;
  /** S9 "Always treat {merchant} this way". */
  alwaysTreat: (transactionId: string) => CategoryRule | undefined;
  /** S9: turn "Always treat {merchant} this way" off again (removes that merchant's rule). */
  forgetRule: (transactionId: string) => void;
  /** S10 and onboarding: accounts entered by hand. */
  setBalance: (accountId: string, balance: Cents) => void;
  /** Add the account, or replace the one with the same id. */
  saveAccount: (account: Account) => void;
  stopTracking: (accountId: string) => void;
  /** S4 Add expected income. */
  addExpectedIncome: (income: ExpectedIncome) => void;
  /** S4 edit mode (E2 "Change the invoice date"). */
  updateExpectedIncome: (income: ExpectedIncome) => void;
  /** S3 Settings. */
  setModules: (modules: Partial<Settings['modules']>) => void;
  setNumbers: (
    numbers: Partial<Pick<Settings, 'taxRate' | 'runwayTarget' | 'monthlySpend'>>,
  ) => void;
  /** Salary / Both: the paycheck that defines "next income" (undefined removes it). */
  setPaySchedule: (pay: Settings['paySchedule']) => void;
  setPrefs: (prefs: Partial<Prefs>) => void;
  /** S11: add a file's transactions to an account; returns what happened. */
  importStatement: (plan: ImportPlan) => ImportOutcome;
  rememberMapping: (headerKey: string, mapping: CsvMapping) => void;
  /** E5 "Add one by hand". */
  addTransaction: (transaction: Transaction) => void;
  /** M7 bank connections: add or replace one (by item id), or remove it. */
  saveConnection: (connection: BankConnection) => void;
  removeConnection: (itemId: string) => void;
  /** Apply what a connected bank sent: accounts, balances, transactions. */
  applyBankSync: (sync: BankSync) => BankSyncOutcome;
  /** Bills: confirm or dismiss a proposal, add or edit, remove. */
  confirmBill: (id: string) => void;
  dismissBill: (id: string) => void;
  saveBill: (bill: Bill) => void;
  removeBill: (id: string) => void;
}

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nextId++}`;

/** "2026-09-25T14:05:00", local time (how lastSynced is written). */
export const localDateTime = (now: Date): string =>
  `${localISODate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

const empty = (today: ISODate): Persisted => ({
  data: newAppData({ today, incomeType: 'freelance', accounts: [] }),
  prefs: DEFAULT_PREFS,
  deposits: [],
  splits: [],
  reviews: [],
  rules: [],
  deferred: [],
  connections: [],
  reviewStep: 1,
  pendingTransfer: null,
  investMoves: [],
  startedOn: null,
});

const demo = (name: ScenarioName) => {
  const data = demoScenario(name);
  return {
    ...empty(data.today),
    data,
    deposits: data.pendingDeposit ? [data.pendingDeposit] : [],
    mode: 'demo' as const,
    scenario: name,
    tagBaseline: null,
    lastReviewDate: null,
  };
};

export const useAppStore = create<AppState>((set, get) => {
  /**
   * Save a new AppData; real mode recomputes what depends on transactions and the date. A
   * pending invest move becomes moved once savings show the money gone (S6).
   */
  const commit = (data: AppData) => {
    const next = get().mode === 'real' ? withDerived(data) : data;
    const moves = settleInvestMoves(get().investMoves, next);
    set(moves === get().investMoves ? { data: next } : { data: next, investMoves: [...moves] });
  };
  const settings = (change: Partial<Settings>) =>
    commit({ ...get().data, settings: { ...get().data.settings, ...change } });

  /** Replace one transaction; if its tax tag changed, move it in or out of the Taxes totals. */
  const updateTransaction = (id: string, change: (t: Transaction) => Transaction) => {
    const { data } = get();
    const before = data.transactions.find((t) => t.id === id);
    if (!before) return;
    const after = change(before);
    const transactions = data.transactions.map((t) => (t.id === id ? after : t));
    const taxYear = data.taxYear ? applyTaxChanges(data.taxYear, [before], [after]) : data.taxYear;
    commit({ ...data, transactions, taxYear });
  };
  const ensureBaseline = () => {
    if (!get().tagBaseline) set({ tagBaseline: get().data.transactions });
  };
  const accounts = (change: (list: Account[]) => Account[]) =>
    commit({ ...get().data, accounts: change(get().data.accounts) });
  const bills = (change: (list: Bill[]) => Bill[]) =>
    commit({ ...get().data, bills: change(get().data.bills) });

  return {
    ...empty(localISODate(new Date())),
    mode: 'real',
    phase: 'booting',
    blocked: null,
    loaded: false,
    scenario: 'on-track',
    tagBaseline: null,
    lastReviewDate: null,
    lockEnabled: false,
    saveProblem: false,

    setPhase: (phase, blocked = null) => set({ phase, blocked }),

    hydrate: (persisted, lockEnabled) =>
      set({
        ...persisted,
        mode: 'real',
        phase: 'ready',
        blocked: null,
        loaded: true,
        tagBaseline: null,
        lastReviewDate: lastReviewDate(persisted.reviews),
        lockEnabled,
        saveProblem: false,
      }),

    reset: () =>
      set({
        ...empty(localISODate(new Date())),
        mode: 'real',
        phase: 'onboarding',
        blocked: null,
        loaded: false,
        tagBaseline: null,
        lastReviewDate: null,
        lockEnabled: false,
        saveProblem: false,
      }),

    setScenario: (name) => set({ ...demo(name), phase: 'ready', blocked: null, loaded: false }),

    setToday: (today) => {
      if (get().mode === 'real' && get().data.today !== today) commit({ ...get().data, today });
    },

    setLockEnabled: (on) => set({ lockEnabled: on }),
    setSaveProblem: (problem) => set({ saveProblem: problem }),

    deferPurchase: (amount, waitUntil) => {
      const purchase: DeferredPurchase = {
        id: newId('deferred'),
        label: 'Purchase',
        amount,
        waitUntil,
        status: 'waiting',
        createdOn: get().data.today,
      };
      set((s) => ({ deferred: [...s.deferred, purchase] }));
      return purchase;
    },

    resolveDeferred: (id, status) => {
      if (status === 'bought') haptic('confirm');
      set((s) => ({ deferred: s.deferred.map((d) => (d.id === id ? { ...d, status } : d)) }));
    },

    waitAgain: (id, waitUntil) =>
      set((s) => ({ deferred: s.deferred.map((d) => (d.id === id ? { ...d, waitUntil } : d)) })),

    markInvestMoved: (where) => {
      const r = markInvestMoved(get().data, { ...where, id: newId('move') });
      if (!r) return null;
      haptic('confirm');
      commit(r.data);
      set((s) => ({ investMoves: [...s.investMoves, r.move] }));
      return r.move;
    },

    addToBalance: (accountId, amount) =>
      accounts((list) =>
        list.map((a) =>
          a.id === accountId && a.source === 'manual'
            ? { ...a, balance: a.balance + amount, enteredOn: get().data.today }
            : a,
        ),
      ),

    saveReviewStep: (step) => set({ reviewStep: step }),

    chooseCategory: (id, category) => {
      ensureBaseline();
      updateTransaction(id, (t) => ({ ...t, category }));
    },

    toggleTax: (id) => {
      ensureBaseline();
      updateTransaction(id, (t) => ({
        ...t,
        tax: !t.tax,
        taxCategory: !t.tax ? (t.taxCategory ?? t.category ?? t.suggestedCategory) : t.taxCategory,
      }));
    },

    /** "Looks right · Next": accept suggestions, mark reviewed, and remember corrections as rules. */
    finishTagging: () => {
      const { data, tagBaseline, rules } = get();
      const baseline = new Map((tagBaseline ?? data.transactions).map((t) => [t.id, t]));
      const tagging = new Set(toTag(data).map((t) => t.id));
      let nextRules = rules;
      const transactions = data.transactions.map((t) => {
        if (!tagging.has(t.id)) return t;
        const chosen = t.category ?? t.suggestedCategory ?? 'Other';
        const was = baseline.get(t.id);
        const corrected = chosen !== (was?.suggestedCategory ?? chosen) || t.tax !== was?.tax;
        if (corrected)
          nextRules = upsertRule(nextRules, ruleFromCorrection(t, chosen, t.tax, t.taxCategory));
        return { ...t, category: chosen, reviewed: true };
      });
      commit({ ...data, transactions });
      set({ rules: nextRules, tagBaseline: null });
    },

    setHabit: (amount, cadence) => settings({ habitTransfer: { amount, cadence } }),

    markTransferMoved: (amount) => {
      haptic('confirm');
      set({ pendingTransfer: { amount, markedOn: get().data.today } });
    },

    /** "Done": the week is reviewed and a new one starts; estimates end after the first review. */
    completeReview: () => {
      haptic('confirm');
      const { data, reviews, pendingTransfer } = get();
      const review = {
        id: `review-${data.today}`,
        date: data.today,
        ...(pendingTransfer ? { transfer: pendingTransfer.amount } : {}),
      };
      commit({
        ...data,
        settings: { ...data.settings, isEstimate: false },
        weekStart: weekStartSnapshot(data),
      });
      set({
        reviews: [...reviews.filter((r) => r.id !== review.id), review],
        lastReviewDate: data.today,
        reviewStep: 1,
      });
    },

    setSplitSettings: (taxRate, runwayTarget) => settings({ taxRate, runwayTarget }),

    confirmDeposit: (split, landed) => {
      haptic('confirm');
      const { data, splits, deposits } = get();
      const next = confirmSplit(data, split, landed);
      const depositId = landed ? data.pendingDeposit?.id : undefined;
      const history = depositsWith(deposits, next.pendingDeposit);
      // Another imported invoice may be waiting: Money offers it next.
      const upNext = currentDeposit(history);
      commit({ ...next, ...(upNext ? { pendingDeposit: upNext } : {}) });
      set({
        deposits: history,
        splits: [
          ...splits,
          { id: newId('split'), date: data.today, split, ...(depositId ? { depositId } : {}) },
        ],
      });
    },

    editTransaction: (id, change) => updateTransaction(id, (t) => ({ ...t, ...change })),

    alwaysTreat: (id) => {
      const t = get().data.transactions.find((x) => x.id === id);
      if (!t) return undefined;
      const rule = ruleFromCorrection(
        t,
        t.category ?? t.suggestedCategory ?? 'Other',
        t.tax,
        t.taxCategory,
      );
      set({ rules: upsertRule(get().rules, rule) });
      return rule;
    },
    forgetRule: (id) => {
      const t = get().data.transactions.find((x) => x.id === id);
      if (!t) return;
      const merchant = normalizeMerchant(t.merchant);
      set({ rules: get().rules.filter((r) => r.merchant !== merchant) });
    },

    setBalance: (id, balance) =>
      accounts((list) => list.map((a) => (a.id === id ? { ...a, balance } : a))),
    saveAccount: (account) =>
      accounts((list) =>
        list.some((a) => a.id === account.id)
          ? list.map((a) => (a.id === account.id ? account : a))
          : [...list, account],
      ),
    stopTracking: (id) => {
      const { data } = get();
      commit({
        ...data,
        accounts: data.accounts.filter((a) => a.id !== id),
        transactions: data.transactions.filter((t) => t.accountId !== id),
      });
    },

    addExpectedIncome: (income) =>
      commit({ ...get().data, expectedIncome: [...get().data.expectedIncome, income] }),

    updateExpectedIncome: (income) =>
      commit({
        ...get().data,
        expectedIncome: get().data.expectedIncome.map((i) => (i.id === income.id ? income : i)),
      }),

    setModules: (modules) => settings({ modules: { ...get().data.settings.modules, ...modules } }),
    setNumbers: (numbers) => settings(numbers),
    setPaySchedule: (paySchedule) => {
      const { paySchedule: _old, ...rest } = get().data.settings;
      commit({ ...get().data, settings: paySchedule ? { ...rest, paySchedule } : rest });
    },
    setPrefs: (prefs) => set({ prefs: { ...get().prefs, ...prefs } }),

    importStatement: (plan) => {
      const { data, rules, deposits, prefs } = get();
      const account: Account = {
        ...plan.account,
        source: plan.account.source === 'manual' ? 'import' : plan.account.source,
        lastSynced: localDateTime(new Date()),
      };
      const accounts = data.accounts.some((a) => a.id === account.id)
        ? data.accounts.map((a) => (a.id === account.id ? account : a))
        : [...data.accounts, account];
      const merge = mergeImport(data.transactions, plan.transactions, account.id, rules, () =>
        newId('txn'),
      );
      const applied = applyImport({ ...data, accounts }, merge);
      const proposals = proposeBills(applied.data);
      commit({ ...applied.data, bills: [...applied.data.bills, ...proposals] });
      set({
        deposits: applied.deposits.reduce(
          (list, d) => depositsWith(list, d),
          depositsWith(deposits, data.pendingDeposit),
        ),
        prefs: {
          ...prefs,
          lastImport: {
            account: account.name,
            on: data.today,
            ...(merge.range ? { from: merge.range.from, to: merge.range.to } : {}),
            added: merge.added.length,
            duplicates: merge.duplicates,
          },
        },
      });
      return {
        added: merge.added.length,
        duplicates: merge.duplicates,
        ...(merge.range ? { range: merge.range } : {}),
        received: applied.received.map((m) => ({
          source: m.expected.source,
          amount: m.transaction.amount,
        })),
        ...(applied.deposits.length && applied.data.pendingDeposit
          ? { depositId: applied.data.pendingDeposit.id }
          : {}),
        proposals: proposals.length,
      };
    },

    rememberMapping: (key, mapping) =>
      set({
        prefs: {
          ...get().prefs,
          importMappings: { ...get().prefs.importMappings, [key]: mapping },
        },
      }),

    addTransaction: (transaction) =>
      commit({ ...get().data, transactions: [...get().data.transactions, transaction] }),

    saveConnection: (c) =>
      set((s) => ({
        connections: s.connections.some((x) => x.itemId === c.itemId)
          ? s.connections.map((x) => (x.itemId === c.itemId ? c : x))
          : [...s.connections, c],
      })),
    removeConnection: (itemId) =>
      set((s) => ({ connections: s.connections.filter((c) => c.itemId !== itemId) })),

    applyBankSync: (sync) => {
      const { data, rules, deposits } = get();
      const accounts = mergeBankAccounts(data.accounts, sync.accounts, data.transactions, () =>
        newId('acct'),
      );
      const merge = mergeBankChanges(
        data.transactions,
        sync.changes,
        accounts,
        rules,
        () => newId('txn'),
        sync.reviewedBefore ? { reviewedBefore: sync.reviewedBefore } : {},
      );
      const applied = applyImport({ ...data, accounts }, merge);
      const proposals = proposeBills(applied.data);
      commit({ ...applied.data, bills: [...applied.data.bills, ...proposals] });
      set({
        deposits: applied.deposits.reduce(
          (list, d) => depositsWith(list, d),
          depositsWith(deposits, data.pendingDeposit),
        ),
      });
      return {
        added: merge.added.length,
        removed: merge.removed,
        ...(applied.deposits.length && applied.data.pendingDeposit
          ? { depositId: applied.data.pendingDeposit.id }
          : {}),
        proposals: proposals.length,
      };
    },

    confirmBill: (id) =>
      bills((list) => list.map((b) => (b.id === id ? { ...b, confirmed: true } : b))),
    dismissBill: (id) =>
      bills((list) => list.map((b) => (b.id === id ? { ...b, dismissed: true } : b))),
    saveBill: (bill) =>
      bills((list) =>
        list.some((b) => b.id === bill.id)
          ? list.map((b) => (b.id === bill.id ? bill : b))
          : [...list, bill],
      ),
    removeBill: (id) => bills((list) => list.filter((b) => b.id !== id)),
  };
});

export const newRecordId = newId;

/**
 * The clock the screens use. Demo mode runs at 9:00 AM on the fixture's "today", so
 * "Updated 7:02 AM" and staleness read the same every time. Real mode uses the device clock.
 */
export const clockFor = (state: Pick<AppState, 'mode' | 'data'>): Date =>
  state.mode === 'demo' ? new Date(`${state.data.today}T09:00:00`) : new Date();
