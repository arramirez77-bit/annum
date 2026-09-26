/**
 * Demo data loader: fixtures/seed.json plus deep-merge overrides from fixtures/scenarios.json.
 * Arrays of objects with an `id` merge by id when the override is an object keyed by id;
 * an array override replaces the array. Keys starting with "_" are scenario metadata.
 */
import { isISODate } from './dates';
import type { AppData } from './types';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function mergeOverride(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (Array.isArray(base) && isObj(override)) {
    return base.map((item) => {
      const id = isObj(item) ? item.id : undefined;
      return typeof id === 'string' && id in override ? mergeOverride(item, override[id]) : item;
    });
  }
  if (isObj(base) && isObj(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = key in base ? mergeOverride(base[key], override[key]) : override[key];
    }
    return out;
  }
  return override;
}

function assertCents(value: unknown, where: string) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Fixture ${where} must be integer cents, got ${String(value)}`);
  }
}

/** Turn raw fixture JSON into AppData, checking the invariants the engine relies on. */
export function toAppData(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('Fixture must be an object');
  if (!isISODate(raw.today)) throw new Error(`Fixture today is not a date: ${String(raw.today)}`);
  const data = raw as unknown as AppData & Record<string, unknown>;
  for (const key of ['accounts', 'bills', 'expectedIncome', 'transactions'] as const) {
    if (!Array.isArray(data[key])) throw new Error(`Fixture ${key} must be an array`);
  }
  data.accounts.forEach((a) => assertCents(a.balance, `account ${a.id} balance`));
  data.bills.forEach((b) => assertCents(b.amount, `bill ${b.id} amount`));
  data.transactions.forEach((t) => assertCents(t.amount, `transaction ${t.id} amount`));
  Object.entries(data.buckets).forEach(([k, v]) => assertCents(v, `bucket ${k}`));

  const {
    _note: _n,
    _expect: _e,
    _lateAssumeDays,
    _savingsUnsplit,
    ...rest
  } = data as AppData & {
    _note?: unknown;
    _expect?: unknown;
    _lateAssumeDays?: number;
    _savingsUnsplit?: boolean;
  };
  return {
    ...(rest as AppData),
    lateAssumeDays: typeof _lateAssumeDays === 'number' ? _lateAssumeDays : 5,
    savingsUnsplit: _savingsUnsplit === true,
  };
}

/** Scenario names in a scenarios file (metadata keys like "_note" excluded). */
export const scenarioNames = (scenarios: Record<string, unknown>): string[] =>
  Object.keys(scenarios).filter((k) => !k.startsWith('_'));

export function loadScenario(
  seed: unknown,
  scenarios: Record<string, unknown>,
  name: string,
): AppData {
  if (!(name in scenarios) || name.startsWith('_')) throw new Error(`Unknown scenario: ${name}`);
  return toAppData(mergeOverride(seed, scenarios[name]));
}
