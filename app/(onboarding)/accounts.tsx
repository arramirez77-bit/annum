import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/state/onboarding';
import { accountRow, accountsFoundNote } from '@/state/account-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  StepLabel,
  Text,
} from '@/ui/components';

// O4 Accounts connected (Step 2 of 4, Figma 62:557) (+ add accounts by hand). docs/05.
export default function Accounts() {
  const o = useOnboarding();
  const banks = useAppStore((s) => s.connections);
  const rows = o.accounts.map(accountRow);
  const found = o.path === 'demo' || o.path === 'bank';
  const edit = (id: string) =>
    router.push({ pathname: '/account/[id]/balance', params: { id, draft: '1' } });
  const next = () => router.push('/face-id');
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <StepLabel step={2} total={4} />,
          headerRight: () => <HeaderButton label="Skip" onPress={next} testID="onboarding-skip" />,
        }}
      />
      <ScreenScroll testID="onboarding-accounts">
        <View style={{ gap: space[4] }}>
          <Text variant="title2" accessibilityRole="header">
            {found
              ? `${rows.length} ${rows.length === 1 ? 'account' : 'accounts'} connected`
              : 'Your accounts'}
          </Text>
          <Text variant="callout" tone="secondary">
            {found
              ? accountsFoundNote(banks.map((b) => b.institution))
              : 'Type in what each account holds today. You can change these any time.'}
          </Text>
        </View>
        <View>
          {rows.map((r, i) => (
            <LedgerRow
              key={r.id}
              surface="dark"
              title={r.title}
              subtitle={r.subtitle}
              value={r.value}
              onPress={r.editable ? () => edit(r.id) : undefined}
              last={i === rows.length - 1}
              testID={`account-${r.id}`}
            />
          ))}
        </View>
        {o.path === 'bank' ? (
          <Button
            variant="secondary"
            label="Add another bank"
            onPress={() => router.push({ pathname: '/bank/connect', params: { from: 'setup' } })}
            testID="account-add-bank"
          />
        ) : null}
        <Button
          variant={o.path === 'bank' ? 'quiet' : 'secondary'}
          label="Add an account by hand"
          onPress={() => edit('new')}
          testID="account-add"
        />
        <AmountInput
          label="About what you spend in a month"
          valueCents={o.monthlySpend}
          onChangeCents={o.setMonthlySpend}
          helper="A rough guess is fine. Annum learns the real number as your spending comes in."
          testID="monthly-spend"
        />
        <Button variant="primary" label="Continue" onPress={next} testID="onboarding-continue" />
      </ScreenScroll>
    </>
  );
}
