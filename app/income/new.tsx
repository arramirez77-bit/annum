import { router, Stack } from 'expo-router';
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

// S4 Add expected income (modal). docs/05.
export default function AddIncome() {
  const addExpectedIncome = useAppStore((s) => s.addExpectedIncome);
  const today = localISODate(new Date());
  const [amount, setAmount] = useState<Cents | null>(null);
  const helper = useAppStore((s) => incomeHelper(s.data, amount));
  const [source, setSource] = useState('');
  const [date, setDate] = useState(addDays(today, 14));

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
          Add expected income
        </Text>
        <Text variant="callout" tone="secondary">
          Add it when you send the invoice. Your daily amount will last until the day it arrives.
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
          label="Add income"
          disabled={!amount}
          onPress={() => {
            if (!amount) return;
            addExpectedIncome({
              id: newRecordId('income'),
              source: source.trim() || 'Client',
              amount,
              date,
            });
            router.back();
          }}
          testID="income-add"
        />
      </ScreenScroll>
    </>
  );
}
