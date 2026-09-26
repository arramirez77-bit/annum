import { router } from 'expo-router';
import { View } from 'react-native';

import { useOnboarding } from '@/state/onboarding';
import { accountRow } from '@/state/account-views';
import { space } from '@/theme';
import { AmountInput, Button, LedgerRow, ScreenScroll, Text } from '@/ui/components';

// O4 Accounts found (+ add brokerage/loan by hand). docs/05.
export default function Accounts() {
  const o = useOnboarding();
  const rows = o.accounts.map(accountRow);
  const edit = (id: string) =>
    router.push({ pathname: '/account/[id]/balance', params: { id, draft: '1' } });
  return (
    <ScreenScroll testID="onboarding-accounts">
      <View style={{ gap: space[4] }}>
        <Text variant="title2" accessibilityRole="header">
          {o.path === 'demo' ? 'Accounts found' : 'Your accounts'}
        </Text>
        <Text tone="secondary">
          {o.path === 'demo'
            ? 'Add a brokerage or loan by hand if it didn’t come through.'
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
      <Button
        variant="secondary"
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
      <Button
        variant="primary"
        label="Continue"
        onPress={() => router.push('/face-id')}
        testID="onboarding-continue"
      />
    </ScreenScroll>
  );
}
