import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addDays, localISODate, type Cents } from '@/domain';
import { newRecordId, useAppStore } from '@/state/store';
import { incomeHelper } from '@/state/views';
import {
  AmountInput,
  Button,
  DateField,
  HeaderButton,
  ScreenScroll,
  Text,
  TextField,
} from '@/ui/components';

// S4 Add expected income (modal); `edit=<id>` changes one (E2 "Change the invoice date"). docs/05.
export default function AddIncome() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const addExpectedIncome = useAppStore((s) => s.addExpectedIncome);
  const updateExpectedIncome = useAppStore((s) => s.updateExpectedIncome);
  const existing = useAppStore((s) => s.data.expectedIncome.find((i) => i.id === edit));
  const today = localISODate(new Date());
  const [amount, setAmount] = useState<Cents | null>(existing?.amount ?? null);
  const helper = useAppStore((s) => incomeHelper(s.data, amount));
  const [source, setSource] = useState(existing?.source ?? '');
  // A late invoice's date has passed: start from a week out.
  const [date, setDate] = useState(
    existing && existing.date > today ? existing.date : addDays(today, existing ? 7 : 14),
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} testID="income-cancel" />
          ),
        }}
      />
      {/* S4 (Figma 65:764). */}
      <ScreenScroll testID="add-income" fill>
        <Text variant="title2" accessibilityRole="header">
          {existing ? 'Change expected income' : 'Add expected income'}
        </Text>
        <Text variant="callout" tone="secondary">
          {existing
            ? 'Move the date to when you now expect it. Your daily amount will last until then.'
            : 'Add it when you send the invoice. Your daily amount will last until the day it arrives.'}
        </Text>
        <AmountInput
          label="Amount"
          valueCents={amount}
          onChangeCents={setAmount}
          helper={helper}
          autoFocus
          testID="income-amount"
        />
        <TextField
          label="From"
          value={source}
          onChangeText={setSource}
          placeholder="Client name"
          autoCapitalize="words"
          testID="income-source"
        />
        <DateField label="Expected on" value={date} minimum={today} onChange={setDate} />
        <Text variant="footnote" tone="secondary">
          If it’s late, Annum tells you and stretches your daily amount. It won’t touch Runway
          without telling you.
        </Text>
        <View style={{ flex: 1 }} />
        <Button
          variant="primary"
          label={existing ? 'Save changes' : 'Add income'}
          disabled={!amount}
          onPress={() => {
            if (!amount) return;
            const income = {
              id: existing?.id ?? newRecordId('income'),
              source: source.trim() || 'Client',
              amount,
              date,
            };
            if (existing) updateExpectedIncome({ ...existing, ...income });
            else addExpectedIncome(income);
            router.back();
          }}
          testID="income-add"
        />
      </ScreenScroll>
    </>
  );
}
