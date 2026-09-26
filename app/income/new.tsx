import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { addDays, localISODate, type Cents } from '@/domain';
import { newRecordId, useAppStore } from '@/state/store';
import {
  AmountInput,
  Button,
  DateField,
  GuardrailNote,
  HeaderButton,
  ScreenScroll,
  TextField,
} from '@/ui/components';

// S4 Add expected income (modal). docs/05.
export default function AddIncome() {
  const addExpectedIncome = useAppStore((s) => s.addExpectedIncome);
  const lateDays = useAppStore((s) => s.data.lateAssumeDays);
  const today = localISODate(new Date());
  const [amount, setAmount] = useState<Cents | null>(null);
  const [source, setSource] = useState('');
  const [date, setDate] = useState(addDays(today, 14));

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Expected income',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} testID="income-cancel" />
          ),
        }}
      />
      <ScreenScroll testID="add-income">
        <AmountInput
          label="Amount"
          valueCents={amount}
          onChangeCents={setAmount}
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
        <GuardrailNote tone="info">
          {`If it’s late, Annum plans as if it lands ${lateDays} days later and tells you, so you’re never counting on money that isn’t here.`}
        </GuardrailNote>
        <Button
          variant="primary"
          label="Add"
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
