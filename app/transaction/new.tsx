import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CATEGORIES, localISODate, type Cents } from '@/domain';
import { newRecordId, useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  Chip,
  DateField,
  HeaderButton,
  ScreenScroll,
  SegmentedControl,
  Text,
  TextField,
} from '@/ui/components';

// E5 "Add one by hand" (modal): a purchase or deposit the bank file doesn't have.
export default function AddTransaction() {
  const accounts = useAppStore((s) => s.data.accounts);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const today = localISODate(new Date());
  const [amount, setAmount] = useState<Cents | null>(null);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(
    accounts.find((a) => a.type === 'checking')?.id ?? accounts[0]?.id ?? '',
  );
  const [category, setCategory] = useState<string | null>(null);
  const ready = !!amount && merchant.trim() !== '' && accountId !== '';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add a transaction',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} testID="txn-cancel" />
          ),
        }}
      />
      <ScreenScroll testID="add-transaction">
        <AmountInput
          label="Amount"
          valueCents={amount}
          onChangeCents={setAmount}
          testID="txn-amount"
        />
        <SegmentedControl
          options={[
            { value: 'out', label: 'Money out' },
            { value: 'in', label: 'Money in' },
          ]}
          value={direction}
          onChange={setDirection}
          accessibilityLabel="Money out or in"
          testID="txn-direction"
        />
        <TextField
          label="Where"
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Corner Market"
          autoCapitalize="words"
          testID="txn-merchant"
        />
        <DateField label="Date" value={date} maximum={today} onChange={setDate} />
        {accounts.length ? (
          <View style={{ gap: space[8] }}>
            <Text variant="subhead" tone="secondary">
              Account
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  kind="category"
                  label={a.name}
                  selected={accountId === a.id}
                  onPress={() => setAccountId(a.id)}
                  testID={`txn-account-${a.id}`}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ gap: space[8] }}>
          <Text variant="subhead" tone="secondary">
            Category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {(direction === 'in' ? ['Income', 'Transfer', 'Other'] : [...CATEGORIES]).map((c) => (
              <Chip
                key={c}
                kind="category"
                label={c}
                selected={category === c}
                onPress={() => setCategory(c)}
                testID={`txn-category-${c}`}
              />
            ))}
          </View>
        </View>
        <Text variant="footnote" tone="secondary">
          This doesn’t change the account’s balance; update that in the weekly review.
        </Text>
        <Button
          variant="primary"
          label="Add"
          disabled={!ready}
          onPress={() => {
            if (!amount) return;
            addTransaction({
              id: newRecordId('txn'),
              accountId,
              date,
              merchant: merchant.trim(),
              amount: direction === 'out' ? -amount : amount,
              ...(category ? { category } : {}),
              tax: false,
              reviewed: category !== null,
            });
            router.back();
          }}
          testID="txn-add"
        />
      </ScreenScroll>
    </>
  );
}
