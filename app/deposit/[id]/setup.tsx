import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { buildSetupView } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Button, GuardrailNote, SegmentedControl, Text } from '@/ui/components';

type Rate = '0.25' | '0.3' | '0.35';
type Months = '3' | '5' | '6';

// O6 First-deposit quick setup (form sheet), then the split. docs/05.
export default function DepositSetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppStore((s) => s.data);
  const setSplitSettings = useAppStore((s) => s.setSplitSettings);
  const current = Math.round(data.settings.runwayTarget / Math.max(data.settings.monthlySpend, 1));
  const [rate, setRate] = useState<Rate>(String(data.settings.taxRate || 0.3) as Rate);
  const [months, setMonths] = useState<Months>(
    (['3', '5', '6'].includes(String(current)) ? String(current) : '5') as Months,
  );
  const v = buildSetupView(data, Number(rate), Number(months), id);

  return (
    <ScrollView
      style={{ backgroundColor: color.bgSurface }}
      contentContainerStyle={{
        paddingTop: space[28],
        paddingHorizontal: layout.screenMargin,
        gap: space[20],
        paddingBottom: space[40],
      }}
      testID="deposit-setup"
    >
      {/* O6 (Figma 70:960). */}
      <View style={{ gap: space[8] }}>
        <Text variant="title2" money align="center" accessibilityRole="header">
          {v.title}
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          {v.subtitle}
        </Text>
      </View>
      {v.showTax ? (
        <View style={{ gap: space[8] }}>
          <Text variant="subhead" tone="secondary">
            Set aside for taxes
          </Text>
          <SegmentedControl
            options={[
              { value: '0.25', label: '25%' },
              { value: '0.3', label: '30%' },
              { value: '0.35', label: '35%' },
            ]}
            value={rate}
            onChange={setRate}
            accessibilityLabel="Tax rate"
            testID="setup-rate"
          />
        </View>
      ) : null}
      <View style={{ gap: space[8] }}>
        <Text variant="subhead" tone="secondary">
          Runway target (months of savings to keep)
        </Text>
        <SegmentedControl
          options={[
            { value: '3', label: '3 months' },
            { value: '5', label: '5 months' },
            { value: '6', label: '6 months' },
          ]}
          value={months}
          onChange={setMonths}
          accessibilityLabel="Runway target"
          testID="setup-months"
        />
      </View>
      <GuardrailNote tone="info">{v.note}</GuardrailNote>
      <Button
        variant="primary"
        label={v.primary}
        onPress={() => {
          setSplitSettings(v.showTax ? Number(rate) : data.settings.taxRate, v.target);
          router.replace(`/deposit/${id}`);
        }}
        testID="setup-continue"
      />
    </ScrollView>
  );
}
