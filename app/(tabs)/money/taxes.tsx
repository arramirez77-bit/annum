import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { taxApplies } from '@/domain';
import { buildTaxesView } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Button, GuardrailNote, LedgerRow, Text } from '@/ui/components';
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
      <Stack.Screen options={pushedHeader(v.title, 'Money')} />
      <ScrollView
        style={{ backgroundColor: color.bgBase }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: layout.screenMargin, gap: space[20] }}
        testID="taxes"
      >
        <Text variant="sentence" testID="taxes-sentence">
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
          <LedgerRow
            surface="dark"
            bucket="tax"
            title={v.reserve.title}
            subtitle={v.reserve.subtitle}
            value={v.reserve.value}
            last
          />
        </View>
        {problem ? <GuardrailNote tone="heads-up">{problem}</GuardrailNote> : null}
        <View style={{ gap: space[8] }}>
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
        </View>
      </ScrollView>
    </>
  );
}
