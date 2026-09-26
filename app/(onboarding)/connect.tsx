import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { demoConnection } from '@/data/demo';
import { bankProvider } from '@/data/sync/provider';
import { localISODate } from '@/domain';
import { useOnboarding } from '@/state/onboarding';
import { color, radius, size, space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  ScreenScroll,
  StepIndicator,
  Text,
} from '@/ui/components';

const STEPS = ['Choose your bank', 'Sign in on your bank’s secure page', 'Your accounts appear'];

/**
 * No bank provider is chosen yet (M7 decision). Development builds connect a sample bank with
 * made-up data instead, so the rest of the app can be tried end to end.
 */
const canConnect = bankProvider !== null || __DEV__;

// O3 Connect (Step 2 of 2). E4 arrives with a real bank connection. docs/05.
export default function Connect() {
  const o = useOnboarding();
  const byHand = () => {
    o.enterByHand();
    router.push('/accounts');
  };
  const connect = () => {
    const now = new Date();
    o.connectDemo(demoConnection(localISODate(now), now));
    router.push('/accounts');
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <StepIndicator step={2} total={2} />,
          headerRight: () => (
            <HeaderButton label="Skip" onPress={byHand} testID="onboarding-skip" />
          ),
        }}
      />
      <ScreenScroll testID="onboarding-connect">
        <Text variant="title2" accessibilityRole="header">
          Bring in your accounts
        </Text>
        <View style={{ gap: space[12] }}>
          {STEPS.map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
              <View
                style={{
                  width: size.radio,
                  height: size.radio,
                  borderRadius: radius.full,
                  backgroundColor: color.bgRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption">{i + 1}</Text>
              </View>
              <Text style={{ flex: 1 }}>{step}</Text>
            </View>
          ))}
        </View>
        <GuardrailNote tone="info">
          Free and read-only. Annum can see balances and transactions; it can never move money.
        </GuardrailNote>
        <View style={{ gap: space[8] }}>
          {canConnect ? (
            <Button
              variant="primary"
              label="Connect a bank"
              onPress={connect}
              testID="connect-bank"
            />
          ) : null}
          <Button
            variant={canConnect ? 'secondary' : 'primary'}
            label="Import a file from my bank"
            onPress={() => router.push('/import')}
            testID="connect-import"
          />
          <Button
            variant="quiet"
            label="Enter balances by hand"
            onPress={byHand}
            testID="connect-by-hand"
          />
        </View>
        {bankProvider === null ? (
          <Text variant="footnote" tone="secondary">
            {__DEV__
              ? 'Development build: “Connect a bank” adds a sample bank with made-up numbers.'
              : 'Connecting a bank directly is coming in a later update.'}
          </Text>
        ) : null}
      </ScreenScroll>
    </>
  );
}
