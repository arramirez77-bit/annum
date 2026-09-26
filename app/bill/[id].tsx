import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addDays, localISODate, type Bill, type Cadence, type Cents } from '@/domain';
import { newRecordId, useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  DateField,
  ScreenScroll,
  SegmentedControl,
  Text,
  TextField,
} from '@/ui/components';

// Add or edit a bill (form sheet).
export default function EditBill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useAppStore((s) => s.data.bills.find((b) => b.id === id));
  const saveBill = useAppStore((s) => s.saveBill);
  const removeBill = useAppStore((s) => s.removeBill);
  const today = localISODate(new Date());
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState<Cents | null>(existing?.amount ?? null);
  const [due, setDue] = useState(
    existing && existing.due >= today ? existing.due : addDays(today, 7),
  );
  const [cadence, setCadence] = useState<Cadence>(existing?.cadence ?? 'monthly');

  const save = () => {
    if (!amount) return;
    const bill: Bill = {
      id: existing?.id ?? newRecordId('bill'),
      name: name.trim() || 'Bill',
      amount,
      due,
      cadence,
      confirmed: true,
      payFrom: 'checking',
    };
    saveBill(bill);
    router.back();
  };

  return (
    <ScreenScroll surface="surface" testID="edit-bill">
      <Text variant="title2" accessibilityRole="header">
        {existing ? existing.name : 'Add a bill'}
      </Text>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Rent"
        autoCapitalize="words"
        testID="bill-name"
      />
      <AmountInput
        label="Amount"
        valueCents={amount}
        onChangeCents={setAmount}
        testID="bill-amount"
      />
      <DateField label="Next due" value={due} minimum={today} onChange={setDue} />
      <SegmentedControl
        options={[
          { value: 'weekly', label: 'Weekly' },
          { value: 'biweekly', label: 'Every 2 weeks' },
          { value: 'monthly', label: 'Monthly' },
        ]}
        value={cadence}
        onChange={setCadence}
        accessibilityLabel="How often"
        testID="bill-cadence"
      />
      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label="Save"
          disabled={!amount}
          onPress={save}
          testID="bill-save"
        />
        {existing ? (
          <Button
            variant="quiet"
            label="Remove this bill"
            onPress={() => {
              removeBill(existing.id);
              router.back();
            }}
            testID="bill-remove"
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}
