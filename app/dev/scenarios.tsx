import { Redirect, router, Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { DEMO_SCENARIOS, type ScenarioName } from '@/data/demo';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Button, OptionCard, Text } from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

const DESCRIPTIONS: Record<ScenarioName, string> = {
  'on-track': 'The seed data: $1,000 until Oct 13',
  'heads-up': 'Checking is low; the card statement lands first',
  'stale-sync': 'Checking last synced Sep 20',
  'late-invoice': 'Oct 17, and the invoice due Oct 13 hasn’t arrived',
  'first-run': 'Estimate: savings not split yet',
  salary: 'Paid every 2 weeks; no taxes',
};

/** Scenario switcher (demo mode, development builds). Also opened by long-pressing the status pill. */
export default function ScenariosScreen() {
  const current = useAppStore((s) => s.scenario);
  const mode = useAppStore((s) => s.mode);
  const setScenario = useAppStore((s) => s.setScenario);
  if (!__DEV__ && mode !== 'demo') return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={pushedHeader('Scenarios', 'Today')} />
      <ScrollView
        style={{ backgroundColor: color.bgBase }}
        contentContainerStyle={{ padding: layout.screenMargin, gap: space[8] }}
        testID="scenarios"
      >
        <Text tone="secondary">Pick a demo scenario. Every screen updates from the same data.</Text>
        {DEMO_SCENARIOS.map((name) => (
          <OptionCard
            key={name}
            title={name}
            description={DESCRIPTIONS[name]}
            selected={current === name}
            testID={`scenario-${name}`}
            onPress={() => {
              setScenario(name);
              router.back();
            }}
          />
        ))}
        {__DEV__ && (
          <Button
            variant="quiet"
            label="Component gallery"
            onPress={() => router.push('/dev/components')}
            testID="open-gallery"
          />
        )}
        {__DEV__ && (
          <Button
            variant="quiet"
            label="Spikes (M0.5)"
            onPress={() => router.push('/dev/spikes')}
            testID="open-spikes"
          />
        )}
      </ScrollView>
    </>
  );
}
