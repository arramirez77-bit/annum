import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { buildTransactionDetail } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
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

/** S9 Transaction detail: category, tax, rule. Autosaves with a quiet note. docs/05. */
export function TransactionDetail({ id, parentTitle }: { id: string; parentTitle: string }) {
  const data = useAppStore((s) => s.data);
  const editTransaction = useAppStore((s) => s.editTransaction);
  const alwaysTreat = useAppStore((s) => s.alwaysTreat);
  const forgetRule = useAppStore((s) => s.forgetRule);
  const rules = useAppStore((s) => s.rules);
  const [saved, setSaved] = useState<string | null>(null);
  const v = buildTransactionDetail(data, id, rules);

  if (!v) {
    return (
      <>
        <Stack.Screen options={pushedHeader('', parentTitle)} />
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
      <Stack.Screen options={pushedHeader('', parentTitle)} />
      {/* S9 (Figma 99:1244). */}
      <ScreenScroll testID="transaction-detail" gap={space[20]}>
        <View style={{ gap: space[4] }}>
          <Text variant="title2" accessibilityRole="header">
            {v.merchant}
          </Text>
          <Text variant="display" money testID="detail-amount">
            {v.amount}
          </Text>
          <Text variant="callout" tone="secondary">
            {v.meta}
          </Text>
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
            {/* TODO(design): Figma shows a "Tax category · {value} ›" row that opens a list, which
                isn't designed yet. Until it is, the categories stay as chips here. */}
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

        <SettingsGroup>
          <SettingsRow
            variant="toggle"
            label={v.ruleLabel}
            value={v.ruleOn}
            onValueChange={(on) => {
              if (on) {
                alwaysTreat(v.id);
                setSaved(v.ruleDone);
              } else {
                forgetRule(v.id);
                setSaved('Saved.');
              }
            }}
            testID="detail-rule"
            last
          />
          {/* TODO(design): "Split this charge ›" goes here once its screen is designed. */}
        </SettingsGroup>
        <Text
          variant="footnote"
          tone="secondary"
          accessibilityLiveRegion="polite"
          testID="detail-saved"
        >
          {saved ?? v.note}
        </Text>
      </ScreenScroll>
    </>
  );
}
