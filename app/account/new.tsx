import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { localISODate, type Account, type Cents } from '@/domain';
import { newRecordId, useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { AmountInput, Button, SegmentedControl, Text, TextField } from '@/ui/components';

type Side = 'have' | 'owe';

/**
 * S13 Add an account by hand (form sheet from S12, Figma 129:2559). "I have this" is an
 * other-asset account and "I owe this" a loan: neither changes the daily amount or the
 * buckets (Andy, 2026-09-28). Onboarding keeps S10's add mode, which picks checking/savings.
 */
export default function AddAccountByHand() {
  const saveAccount = useAppStore((s) => s.saveAccount);
  const [name, setName] = useState('');
  const [side, setSide] = useState<Side>('have');
  const [balance, setBalance] = useState<Cents | null>(null);

  const add = () => {
    const account: Account = {
      id: newRecordId('account'),
      source: 'manual',
      status: 'ok',
      name: name.trim() || (side === 'owe' ? 'Loan' : 'Account'),
      type: side === 'owe' ? 'loan' : 'brokerage',
      balance: balance ?? 0,
      enteredOn: localISODate(new Date()),
    };
    saveAccount(account);
    router.back();
  };

  return (
    <ScrollView
      style={{ backgroundColor: color.bgSurface }}
      contentContainerStyle={{
        paddingTop: space[28],
        paddingHorizontal: layout.screenMargin,
        paddingBottom: space[40],
        gap: space[16],
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID="add-by-hand"
    >
      <Text variant="title2" align="center" accessibilityRole="header">
        Add an account by hand
      </Text>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Cash, car loan, brokerage…"
        autoCapitalize="words"
        testID="by-hand-name"
      />
      <SegmentedControl<Side>
        options={[
          { value: 'have', label: 'I have this' },
          { value: 'owe', label: 'I owe this' },
        ]}
        value={side}
        onChange={setSide}
        accessibilityLabel="Is this money you have or money you owe?"
        testID="by-hand-side"
      />
      <AmountInput
        label={side === 'owe' ? 'Owed today' : 'Balance today'}
        valueCents={balance}
        onChangeCents={setBalance}
        helper="You update this balance yourself. It shows up in your weekly review so it stays current."
        testID="by-hand-balance"
      />
      <View style={{ gap: space[16] }}>
        <Button variant="primary" label="Add account" onPress={add} testID="by-hand-add" />
        <Button
          variant="quiet"
          label="Cancel"
          onPress={() => router.back()}
          testID="by-hand-cancel"
        />
      </View>
    </ScrollView>
  );
}
