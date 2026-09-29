import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { demoConnection } from '@/data/demo';
import { localISODate } from '@/domain';
import { resumeSetupConnections } from '@/state/bank';
import { useOnboarding } from '@/state/onboarding';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  NumberedSteps,
  StepLabel,
  Text,
} from '@/ui/components';

const STEPS = [
  { title: 'Choose your bank', detail: 'Most US banks and credit unions' },
  { title: 'Sign in on your bank’s secure page', detail: 'Annum never sees your password' },
  { title: 'Your accounts appear here', detail: 'Balances and up to two years of history' },
];

// O3 Connect (Step 2 of 4, Figma 62:508). Plaid Link opens from the connect sheet (bank/connect). docs/05.
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
          headerTitle: () => <StepLabel step={2} total={4} />,
          headerRight: () =>
            connected ? null : (
              <HeaderButton label="Skip" onPress={byHand} testID="onboarding-skip" />
            ),
        }}
      />
      <ScreenScroll testID="onboarding-connect">
        <View style={{ gap: space[4] }}>
          <Text variant="title2" accessibilityRole="header">
            Connect your banks
          </Text>
          <Text variant="callout" tone="secondary">
            Annum uses Plaid, a secure bank connection, to read your balances and transactions. It
            can see your money but can never move it.
          </Text>
        </View>
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
          <NumberedSteps steps={STEPS} />
        )}
        <GuardrailNote tone="info">
          Free and read-only. Annum keeps your data on this phone. Plaid holds your bank connection
          so it can sync.
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
            label={connected ? 'Add another bank' : 'Import a file'}
            onPress={connected ? connect : () => router.push('/import')}
            testID={connected ? 'connect-another' : 'connect-import'}
          />
          {connected ? null : (
            <Button
              variant="quiet"
              label="Enter a balance by hand"
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
