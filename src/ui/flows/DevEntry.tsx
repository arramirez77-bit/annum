import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { useAppStore } from '@/state/store';

/** From the lock or can't-open screens, switch to demo data first so the app shows. */
function openScenarios() {
  const { phase, setScenario } = useAppStore.getState();
  if (phase === 'booting' || phase === 'locked' || phase === 'blocked') setScenario('on-track');
  router.push('/dev/scenarios');
}

/**
 * Development builds: long-press to open the demo scenarios (like the status pill on Today),
 * so tests can reach them from the first-run and lock screens. Plain children in release.
 */
export function DevEntry({ children }: { children: ReactNode }) {
  if (!__DEV__) return <>{children}</>;
  return (
    <Pressable
      onLongPress={openScenarios}
      accessibilityLabel="Annum"
      accessibilityHint="Development build: long-press for demo scenarios"
      testID="dev-entry"
    >
      {children}
    </Pressable>
  );
}
