import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { buildTransactionsView, type TransactionFilter } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import { Button, Chip, LedgerRow, ScreenScroll, Text } from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

/**
 * S1 Transactions (+E5 none yet), for all accounts (Money) or one account (Settings).
 * Figma 64:656 / 71:992. docs/05.
 */
export function TransactionsList({
  accountId,
  parentTitle,
  detailPath,
}: {
  accountId?: string;
  parentTitle: string;
  /** Where a row opens S9: inside the Money tab, or on the root stack from Settings. */
  detailPath: '/money/transaction/[id]' | '/transaction/[id]';
}) {
  const data = useAppStore((s) => s.data);
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const v = buildTransactionsView(data, filter, accountId);
  const none = !!v.empty && filter === 'all';
  return (
    <>
      <Stack.Screen options={pushedHeader('', parentTitle)} />
      <ScreenScroll testID="transactions">
        <Text variant="title1" accessibilityRole="header">
          {v.title}
        </Text>
        {none ? null : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {v.filters.map((f) => (
              <Chip
                key={f.value}
                kind={f.value === 'tax' ? 'tax' : 'category'}
                label={f.label}
                selected={filter === f.value}
                onPress={() => setFilter(f.value)}
                testID={`filter-${f.value}`}
              />
            ))}
          </View>
        )}
        {v.empty ? (
          <Text variant="callout" tone="secondary" testID="transactions-empty">
            {v.empty}
          </Text>
        ) : null}
        {none && !accountId ? (
          <Button
            variant="secondary"
            label="Import a file"
            onPress={() => router.push('/import')}
            testID="txn-import"
          />
        ) : null}
        {v.groups.map((g) => (
          <View key={g.date} style={{ paddingTop: space[4] }}>
            <Text variant="footnote" tone="secondary" accessibilityRole="header">
              {g.label}
            </Text>
            {g.rows.map((r) => (
              <LedgerRow
                key={r.id}
                surface="dark"
                title={r.title}
                subtitle={r.subtitle}
                value={r.value}
                chevron={false}
                onPress={() => router.push({ pathname: detailPath, params: { id: r.id } })}
                testID={`txn-${r.id}`}
              />
            ))}
          </View>
        ))}
        {/* No frame: adding by hand stays, as a quiet action. */}
        <Button
          variant="quiet"
          label="Add one by hand"
          onPress={() => router.push('/transaction/new')}
          testID={none ? 'txn-add-by-hand' : 'txn-add-more'}
        />
      </ScreenScroll>
    </>
  );
}
