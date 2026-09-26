import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { formatDollars, type Cents } from '@/domain';
import { useWhatIfView } from '@/state/hooks';
import { useAppStore } from '@/state/store';
import { color, layout, opacity, space } from '@/theme';
import { AmountInput, Button, GuardrailNote, LedgerRow, Text } from '@/ui/components';
import { useCountUp } from '@/ui/motion';

function Cancel() {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      testID="what-if-cancel"
      hitSlop={space[8]}
      style={({ pressed }) => pressed && { opacity: opacity.pressed }}
    >
      <Text>Cancel</Text>
    </Pressable>
  );
}

// 10 fits · 11 guardrail. docs/05.
export default function WhatIfScreen() {
  const [amount, setAmount] = useState<Cents | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const v = useWhatIfView(amount);
  const deferPurchase = useAppStore((s) => s.deferPurchase);
  const free = useCountUp(v.rows[0].amount ?? 0);
  const perDay = useCountUp(v.rows[1].amount ?? 0);
  const values: Record<string, string> = {
    free: formatDollars(free),
    'per-day': formatDollars(perDay),
    runway: v.rows[2].value,
  };

  const onPrimary = () => {
    if (v.guardrail && amount && v.waitUntil) deferPurchase(amount, v.waitUntil);
    router.back();
  };
  const onQuiet = () => {
    if (v.guardrail) {
      router.back();
    } else {
      setAmount(null);
      setInputKey((k) => k + 1); // remount to refocus the empty field
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'What would this do?', headerLeft: () => <Cancel /> }} />
      <ScrollView
        style={{ backgroundColor: color.bgBase }}
        contentContainerStyle={{ padding: layout.screenMargin, gap: space[24] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        testID="what-if"
      >
        <AmountInput
          key={inputKey}
          label="If I spend"
          valueCents={amount}
          onChangeCents={setAmount}
          autoFocus
          testID="what-if-amount"
        />
        <View>
          {v.rows.map((row, i) => (
            <LedgerRow
              key={row.id}
              surface="dark"
              title={row.title}
              value={values[row.id]}
              last={i === v.rows.length - 1}
              testID={`what-if-row-${row.id}`}
            />
          ))}
        </View>
        <GuardrailNote tone={v.guardrail ? 'heads-up' : 'info'} testID="what-if-note">
          {v.note}
        </GuardrailNote>
        {!v.empty ? (
          <View style={{ gap: space[8] }}>
            <Button
              variant="primary"
              label={v.primary}
              onPress={onPrimary}
              testID="what-if-primary"
            />
            <Button variant="quiet" label={v.quiet} onPress={onQuiet} testID="what-if-quiet" />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
