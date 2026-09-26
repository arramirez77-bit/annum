/** App state (Zustand). Demo mode loads the fixtures; storage arrives in M5, bank data later. */
import { create } from 'zustand';

import { demoScenario, type ScenarioName } from '@/data/demo';
import {
  applyTaxChanges,
  confirmSplit,
  ruleFromCorrection,
  toTag,
  upsertRule,
  type AppData,
  type Cadence,
  type CategoryRule,
  type Cents,
  type DeferredPurchase,
  type ISODate,
  type Split,
  type Transaction,
} from '@/domain';
import { haptic } from '@/services/haptics';

export interface PendingTransfer {
  amount: Cents;
  markedOn: ISODate;
}

export interface AppState {
  mode: 'demo' | 'real';
  scenario: ScenarioName;
  data: AppData;
  deferred: DeferredPurchase[];
  rules: CategoryRule[];
  /** Weekly review: the step to resume at, and what was chosen along the way. */
  reviewStep: number;
  /** Transactions as they were when tagging started (to tell corrections from suggestions). */
  tagBaseline: Transaction[] | null;
  pendingTransfer: PendingTransfer | null;
  lastReviewDate: ISODate | null;

  setScenario: (name: ScenarioName) => void;
  deferPurchase: (amount: Cents, waitUntil: ISODate) => DeferredPurchase;
  saveReviewStep: (step: number) => void;
  chooseCategory: (transactionId: string, category: string) => void;
  toggleTax: (transactionId: string) => void;
  finishTagging: () => void;
  setHabit: (amount: Cents, cadence: Cadence) => void;
  markTransferMoved: (amount: Cents) => void;
  completeReview: () => void;
  setSplitSettings: (taxRate: number, runwayTarget: Cents) => void;
  confirmDeposit: (split: Split, landed: boolean) => void;
}

let nextId = 1;

const fresh = (name: ScenarioName) => ({
  scenario: name,
  data: demoScenario(name),
  rules: [] as CategoryRule[],
  reviewStep: 1,
  tagBaseline: null,
  pendingTransfer: null,
  lastReviewDate: null,
});

export const useAppStore = create<AppState>((set, get) => {
  /** Replace one transaction; if its tax tag changed, move it in or out of the Taxes totals. */
  const updateTransaction = (id: string, change: (t: Transaction) => Transaction) => {
    const { data } = get();
    const before = data.transactions.find((t) => t.id === id);
    if (!before) return;
    const after = change(before);
    const transactions = data.transactions.map((t) => (t.id === id ? after : t));
    const taxYear = data.taxYear ? applyTaxChanges(data.taxYear, [before], [after]) : data.taxYear;
    set({ data: { ...data, transactions, taxYear } });
  };
  const ensureBaseline = () => {
    if (!get().tagBaseline) set({ tagBaseline: get().data.transactions });
  };

  return {
    mode: 'demo',
    deferred: [],
    ...fresh('on-track'),

    setScenario: (name) => set({ ...fresh(name), deferred: [] }),

    deferPurchase: (amount, waitUntil) => {
      const purchase: DeferredPurchase = {
        id: `deferred-${nextId++}`,
        label: 'Purchase',
        amount,
        waitUntil,
        status: 'waiting',
      };
      set((s) => ({ deferred: [...s.deferred, purchase] }));
      return purchase;
    },

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
      set({ data: { ...data, transactions }, rules: nextRules, tagBaseline: null });
    },

    setHabit: (amount, cadence) => {
      const { data } = get();
      set({
        data: { ...data, settings: { ...data.settings, habitTransfer: { amount, cadence } } },
      });
    },

    markTransferMoved: (amount) => {
      haptic('confirm');
      set({ pendingTransfer: { amount, markedOn: get().data.today } });
    },

    /** "Done": the week is reviewed; estimates end after the first review. */
    completeReview: () => {
      haptic('confirm');
      const { data } = get();
      set({
        data: { ...data, settings: { ...data.settings, isEstimate: false } },
        lastReviewDate: data.today,
        reviewStep: 1,
      });
    },

    setSplitSettings: (taxRate, runwayTarget) => {
      const { data } = get();
      set({ data: { ...data, settings: { ...data.settings, taxRate, runwayTarget } } });
    },

    confirmDeposit: (split, landed) => {
      haptic('confirm');
      set({ data: confirmSplit(get().data, split, landed) });
    },
  };
});

/**
 * The clock the screens use. Demo mode runs at 9:00 AM on the fixture's "today", so
 * "Updated 7:02 AM" and staleness read the same every time. Real mode uses the device clock.
 */
export const clockFor = (state: Pick<AppState, 'mode' | 'data'>): Date =>
  state.mode === 'demo' ? new Date(`${state.data.today}T09:00:00`) : new Date();
