/** App state (Zustand). Demo mode loads the fixtures; real mode arrives in M5–M6. */
import { create } from 'zustand';

import { demoScenario, type ScenarioName } from '@/data/demo';
import type { AppData, Cents, DeferredPurchase, ISODate } from '@/domain';

export interface AppState {
  mode: 'demo' | 'real';
  scenario: ScenarioName;
  data: AppData;
  deferred: DeferredPurchase[];
  setScenario: (name: ScenarioName) => void;
  deferPurchase: (amount: Cents, waitUntil: ISODate) => DeferredPurchase;
}

let nextId = 1;

export const useAppStore = create<AppState>((set) => ({
  mode: 'demo',
  scenario: 'on-track',
  data: demoScenario('on-track'),
  deferred: [],
  setScenario: (name) => set({ scenario: name, data: demoScenario(name) }),
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
}));

/**
 * The clock the screens use. Demo mode runs at 9:00 AM on the fixture's "today", so
 * "Updated 7:02 AM" and staleness read the same every time. Real mode uses the device clock.
 */
export const clockFor = (state: Pick<AppState, 'mode' | 'data'>): Date =>
  state.mode === 'demo' ? new Date(`${state.data.today}T09:00:00`) : new Date();
