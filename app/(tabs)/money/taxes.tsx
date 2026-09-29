import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { taxApplies } from '@/domain';
import { buildTaxesView } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { Button, GuardrailNote, LedgerRow, ScreenScroll, Text } from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

// S2 Taxes (hidden when the Tax module is off). docs/05.
export default function TaxesScreen() {
  const data = useAppStore((s) => s.data);
  const v = buildTaxesView(data);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!taxApplies(data)) return <Redirect href="/money" />;

  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(true);
    setProblem(null);
    try {
      const exporter = await import('@/data/export');
      await (kind === 'csv'
        ? exporter.shareTaxCsv(data, v.year)
        : exporter.shareTaxPdf(data, v.year));
    } catch {
      setProblem("That export didn't work, so nothing was shared. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={pushedHeader('', 'Money')} />
      {/* S2 (Figma 64:716). */}
      <ScreenScroll testID="taxes">
        <Text variant="title1" accessibilityRole="header">
          {v.title}
        </Text>
        <Text variant="callout" tone="secondary" testID="taxes-sentence">
          {v.sentence}
        </Text>
        <View>
          {v.categories.map((c) => (
            <LedgerRow
              key={c.title}
              surface="dark"
              title={c.title}
              subtitle={c.subtitle}
              value={c.value}
            />
          ))}
        </View>
        <Text variant="subhead" tone="secondary" accessibilityRole="header">
          Set aside
        </Text>
        <LedgerRow
          surface="dark"
          bucket="tax"
          title={v.reserve.title}
          subtitle={v.reserve.subtitle}
          value={v.reserve.value}
        />
        {problem ? <GuardrailNote tone="heads-up">{problem}</GuardrailNote> : null}
        <Button
          variant="primary"
          label={v.primary}
          disabled={busy}
          onPress={() => run('csv')}
          testID="export-csv"
        />
        <Button
          variant="quiet"
          label={v.quiet}
          disabled={busy}
          onPress={() => run('pdf')}
          testID="export-pdf"
        />
      </ScreenScroll>
    </>
  );
}
