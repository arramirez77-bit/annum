import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { buildTransactionsView, type TransactionFilter } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Chip, GuardrailNote, LedgerRow, Text } from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

// S1 Transactions (+E5 none yet). docs/05.
export default function TransactionsScreen() {
  const data = useAppStore((s) => s.data);
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const v = buildTransactionsView(data, filter);
  return (
    <>
      <Stack.Screen options={pushedHeader('Transactions', 'Money')} />
      <ScrollView
        style={{ backgroundColor: color.bgBase }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: layout.screenMargin, gap: space[20] }}
        testID="transactions"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {v.filters.map((f) => (
            <Chip
              key={f.value}
              kind="category"
              label={f.label}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
              testID={`filter-${f.value}`}
            />
          ))}
        </View>
        {v.empty ? <GuardrailNote tone="info">{v.empty}</GuardrailNote> : null}
        {v.groups.map((g) => (
          <View key={g.date} style={{ gap: space[4] }}>
            <Text variant="footnote" tone="secondary" accessibilityRole="header">
              {g.label}
            </Text>
            <View>
              {g.rows.map((r, i) => (
                <LedgerRow
                  key={r.id}
                  surface="dark"
                  title={r.title}
                  subtitle={r.subtitle}
                  value={r.value}
                  last={i === g.rows.length - 1}
                  onPress={() =>
                    router.push({ pathname: '/money/transaction/[id]', params: { id: r.id } })
                  }
                  testID={`txn-${r.id}`}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
