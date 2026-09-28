import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { demoConnection } from '@/data/demo';
import { localISODate } from '@/domain';
import { resumeSetupConnections } from '@/state/bank';
import { useOnboarding } from '@/state/onboarding';
import { useAppStore } from '@/state/store';
import { color, radius, size, space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  StepIndicator,
  Text,
} from '@/ui/components';

const STEPS = ['Choose your bank', 'Sign in on your bank’s secure page', 'Your accounts appear'];

// O3 Connect (Step 2 of 2). Plaid Link opens from the connect sheet (bank/connect). docs/05.
export default function Connect() {
  const o = useOnboarding();
  const banks = useAppStore((s) => s.connections);
  useEffect(() => {
    // A bank connected before the app was closed mid-setup comes back, never connected again.
    void resumeSetupConnections();
  }, []);

  const byHand = () => {
    o.enterByHand();
    router.push('/accounts');
  };
  const connect = () => router.push({ pathname: '/bank/connect', params: { from: 'setup' } });
  const sample = () => {
    const now = new Date();
    o.connectDemo(demoConnection(localISODate(now), now));
    router.push('/accounts');
  };
  const connected = banks.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <StepIndicator step={2} total={2} />,
          headerRight: () =>
            connected ? null : (
              <HeaderButton label="Skip" onPress={byHand} testID="onboarding-skip" />
            ),
        }}
      />
      <ScreenScroll testID="onboarding-connect">
        <Text variant="title2" accessibilityRole="header">
          Bring in your accounts
        </Text>
        {connected ? (
          <View>
            {banks.map((b, i) => (
              <LedgerRow
                key={b.itemId}
                surface="dark"
                title={b.institution}
                subtitle={b.status === 'exchanging' ? 'Finishing connecting…' : 'Connected'}
                last={i === banks.length - 1}
                testID={`setup-bank-${i}`}
              />
            ))}
          </View>
        ) : (
          <View style={{ gap: space[12] }}>
            {STEPS.map((step, i) => (
              <View
                key={step}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}
              >
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
        )}
        <GuardrailNote tone="info">
          Free and read-only. Annum can see balances and transactions; it can never move money.
        </GuardrailNote>
        <View style={{ gap: space[8] }}>
          {connected ? (
            <Button
              variant="primary"
              label="Continue"
              onPress={() => router.push('/accounts')}
              testID="connect-continue"
            />
          ) : (
            <Button
              variant="primary"
              label="Connect a bank"
              onPress={connect}
              testID="connect-bank"
            />
          )}
          <Button
            variant="secondary"
            label={connected ? 'Add another bank' : 'Import a file from my bank'}
            onPress={connected ? connect : () => router.push('/import')}
            testID={connected ? 'connect-another' : 'connect-import'}
          />
          {connected ? null : (
            <Button
              variant="quiet"
              label="Enter balances by hand"
              onPress={byHand}
              testID="connect-by-hand"
            />
          )}
          {__DEV__ && !connected ? (
            <Button
              variant="quiet"
              label="Use a sample bank (development)"
              onPress={sample}
              testID="connect-sample"
            />
          ) : null}
        </View>
      </ScreenScroll>
    </>
  );
}
