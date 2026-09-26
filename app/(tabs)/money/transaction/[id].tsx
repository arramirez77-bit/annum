import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { buildTransactionDetail } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  Button,
  Chip,
  GuardrailNote,
  ScreenScroll,
  SettingsGroup,
  SettingsRow,
  Text,
} from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="footnote" tone="secondary" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

// S9 Transaction detail: category, tax, rule. Autosaves with a quiet note. docs/05.
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppStore((s) => s.data);
  const editTransaction = useAppStore((s) => s.editTransaction);
  const alwaysTreat = useAppStore((s) => s.alwaysTreat);
  const [saved, setSaved] = useState<string | null>(null);
  const v = buildTransactionDetail(data, id);

  if (!v) {
    return (
      <>
        <Stack.Screen options={pushedHeader('', 'Transactions')} />
        <ScreenScroll>
          <GuardrailNote tone="info">
            This transaction isn’t on this phone anymore. It may have been removed with its account.
          </GuardrailNote>
        </ScreenScroll>
      </>
    );
  }

  const change = (patch: Parameters<typeof editTransaction>[1]) => {
    editTransaction(v.id, patch);
    setSaved('Saved.');
  };

  return (
    <>
      <Stack.Screen options={pushedHeader(v.merchant, 'Transactions')} />
      <ScreenScroll testID="transaction-detail" gap={space[24]}>
        <View style={{ gap: space[4] }}>
          <Text variant="display" money testID="detail-amount">
            {v.amount}
          </Text>
          <Text tone="secondary">{v.meta}</Text>
        </View>

        <Section title="Category">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {v.categories.map((c) => (
              <Chip
                key={c}
                kind="category"
                label={c}
                selected={v.category === c}
                onPress={() => change({ category: c })}
                testID={`detail-category-${c}`}
              />
            ))}
          </View>
        </Section>

        {v.showTaxes ? (
          <Section title="Taxes">
            <SettingsGroup>
              <SettingsRow
                variant="toggle"
                label="Work expense"
                value={v.tax}
                onValueChange={(tax) => change(tax ? { tax, taxCategory: v.taxCategory } : { tax })}
                testID="detail-tax"
                last
              />
            </SettingsGroup>
            {v.tax ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
                {v.taxCategories.map((c) => (
                  <Chip
                    key={c}
                    kind="tax"
                    label={c}
                    selected={v.taxCategory === c}
                    onPress={() => change({ taxCategory: c })}
                    testID={`detail-tax-category-${c}`}
                  />
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        <Button
          variant="secondary"
          label={v.ruleLabel}
          onPress={() => {
            alwaysTreat(v.id);
            setSaved(v.ruleDone);
          }}
          testID="detail-rule"
        />
        <Text
          variant="footnote"
          tone="secondary"
          accessibilityLiveRegion="polite"
          testID="detail-saved"
        >
          {saved ?? 'Changes save as you go.'}
        </Text>
      </ScreenScroll>
    </>
  );
}
