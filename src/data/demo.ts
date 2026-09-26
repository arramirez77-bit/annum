/** Demo mode data: fixtures/seed.json plus the scenario overrides (docs/02 "Two modes"). */
import scenariosJson from '../../fixtures/scenarios.json';
import seedJson from '../../fixtures/seed.json';
import { loadScenario, scenarioNames, toAppData, type AppData } from '@/domain';

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
