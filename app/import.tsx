import { router } from 'expo-router';

import { useAppStore } from '@/state/store';
import { useOnboarding } from '@/state/onboarding';
import { Button, GuardrailNote, ScreenScroll, Text } from '@/ui/components';

// S11 Import a file (CSV/OFX) — built in M6. Until then, point to entering balances by hand.
export default function ImportFile() {
  const onboarding = useAppStore((s) => s.phase === 'onboarding');
  return (
    <ScreenScroll testID="import">
      <Text variant="title2" accessibilityRole="header">
        Import a file from your bank
      </Text>
      <GuardrailNote tone="info">
        Importing a CSV or OFX file from your bank arrives in the next update. For now, type in your
        balances; nothing you enter is lost when importing arrives.
      </GuardrailNote>
      {onboarding ? (
        <Button
          variant="primary"
          label="Enter balances by hand"
          onPress={() => {
            useOnboarding.getState().enterByHand();
            router.replace('/accounts');
          }}
          testID="import-by-hand"
        />
      ) : (
        <Button variant="secondary" label="Back" onPress={() => router.back()} />
      )}
    </ScreenScroll>
  );
}
