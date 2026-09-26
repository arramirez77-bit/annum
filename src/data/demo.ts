/** Demo mode data: fixtures/seed.json plus the scenario overrides (docs/02 "Two modes"). */
import scenariosJson from '../../fixtures/scenarios.json';
import seedJson from '../../fixtures/seed.json';
import {
  addDays,
  daysBetween,
  loadScenario,
  localISODate,
  scenarioNames,
  toAppData,
  type Account,
  type AppData,
  type Bill,
  type Cents,
  type ExpectedIncome,
  type ISODate,
  type Transaction,
} from '@/domain';

const scenarios = scenariosJson as Record<string, unknown>;

export type ScenarioName =
  'on-track' | 'heads-up' | 'stale-sync' | 'late-invoice' | 'first-run' | 'salary';

export const DEMO_SCENARIOS = scenarioNames(scenarios) as ScenarioName[];

/** A fresh copy every time, so no caller can mutate the fixtures. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const demoSeed = (): AppData => toAppData(copy(seedJson));

export const demoScenario = (name: ScenarioName): AppData =>
  loadScenario(copy(seedJson), scenarios, name);

/** Expected values some scenarios carry for tests (e.g. salary `_expect`). */
export const scenarioExpectations = (name: ScenarioName): unknown =>
  (scenarios[name] as Record<string, unknown> | undefined)?._expect;

export interface DemoConnection {
  accounts: Account[];
  transactions: Transaction[];
  bills: Bill[];
  expectedIncome: ExpectedIncome[];
  monthlySpend: Cents;
}

/** "2026-09-25T07:02:00", local time (the fixtures' lastSynced format). */
const localDateTime = (now: Date) =>
  `${localISODate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

/**
 * The sample bank (O3's demo path while no bank provider is chosen): the first-run fixture,
 * moved so its dates sit around today, as if it synced just now. Fictional data only.
 */
export function demoConnection(today: ISODate, now: Date): DemoConnection {
  const base = demoScenario('first-run');
  const shift = daysBetween(base.today, today);
  const move = (d: ISODate) => addDays(d, shift);
  return {
    accounts: base.accounts.map((a) => ({
      ...a,
      ...(a.source === 'manual' ? {} : { source: 'demo' as const, lastSynced: localDateTime(now) }),
      ...(a.statementDue ? { statementDue: move(a.statementDue) } : {}),
    })),
    transactions: base.transactions.map((t) => ({ ...t, date: move(t.date) })),
    bills: base.bills.map((b) => ({ ...b, due: move(b.due) })),
    expectedIncome: base.expectedIncome.map((i) => ({ ...i, date: move(i.date) })),
    monthlySpend: base.settings.monthlySpend,
  };
}
