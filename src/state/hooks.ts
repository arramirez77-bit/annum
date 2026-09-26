/** Screen hooks: select from the store and build the view once per change. */
import { useMemo } from 'react';

import type { Cents } from '@/domain';

import { clockFor, useAppStore } from './store';
import { buildMoneyView, buildTodayView, buildWhatIfView } from './views';

export function useTodayView() {
  const data = useAppStore((s) => s.data);
  const mode = useAppStore((s) => s.mode);
  return useMemo(() => buildTodayView(data, clockFor({ mode, data })), [data, mode]);
}

export function useMoneyView() {
  const data = useAppStore((s) => s.data);
  return useMemo(() => buildMoneyView(data), [data]);
}

export function useWhatIfView(purchase: Cents | null) {
  const data = useAppStore((s) => s.data);
  return useMemo(() => buildWhatIfView(data, purchase), [data, purchase]);
}
