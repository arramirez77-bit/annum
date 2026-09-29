import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { formatDollars, formatShortDate } from '@/domain';
import { useMoneyView } from '@/state/hooks';
import { movingRows } from '@/state/invest-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import {
  BucketBar,
  BucketRow,
  Button,
  GuardrailNote,
  LedgerRow,
  SettingsGroup,
  SettingsRow,
  Text,
} from '@/ui/components';

// 03 Money (+E3 not split yet, P2 salary). docs/05.
export default function MoneyScreen() {
  const v = useMoneyView();
  const deposit = useAppStore((s) => s.data.pendingDeposit);
  const landed = deposit && !deposit.confirmed ? deposit : undefined;
  const investMoves = useAppStore((s) => s.investMoves);
  const moving = movingRows(investMoves);

  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: space[16],
        paddingBottom: space[24],
        paddingHorizontal: layout.screenMargin,
      }}
      testID="money"
    >
      {/* 03 Money / E3 not split yet / P2 salary (Figma 58:62, 70:1119, 71:1407). */}
      <Text variant="title1" accessibilityRole="header">
        Money
      </Text>
      <Text variant="callout" tone="secondary">
        {v.unsplit
          ? 'Your savings aren’t split into buckets yet.'
          : 'What your savings are set aside for.'}
      </Text>

      <View
        accessible
        accessibilityLabel={`Savings, ${formatDollars(v.savings)}`}
        style={{
          marginTop: space[28],
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="subhead" tone="secondary">
          Savings
        </Text>
        <Text variant="title2" money testID="money-savings">
          {formatDollars(v.savings)}
        </Text>
      </View>
      <View style={{ marginTop: space[14] }}>
        {/* E3: one muted bar, no preview segments. */}
        <BucketBar
          segments={v.unsplit ? [] : v.segments}
          muted={v.unsplit}
          accessibilityLabel={v.barLabel}
        />
      </View>

      <View style={{ marginTop: space[24], gap: space[8] }}>
        {v.unsplit && v.previewNote ? (
          <>
            <GuardrailNote tone="info" testID="unsplit-preview">
              {v.previewNote}
            </GuardrailNote>
            <Button
              variant="primary"
              label="Split my savings now"
              onPress={() => router.push('/deposit/unsplit/setup')}
              testID="split-now"
            />
          </>
        ) : null}

        {landed && !v.unsplit ? (
          <>
            <GuardrailNote tone="info" testID="deposit-landed">
              {`${formatDollars(landed.amount)}${landed.source ? ` from ${landed.source}` : ''} landed ${formatShortDate(landed.date)}. Split it so every dollar has a job.`}
            </GuardrailNote>
            <Button
              variant="primary"
              label="Split it"
              onPress={() => router.push(`/deposit/${landed.id}`)}
              testID="split-deposit"
            />
          </>
        ) : null}

        {/* E3 shows no bucket cards until the first split. */}
        {(v.unsplit ? [] : v.rows).map((row) => (
          <BucketRow
            key={row.bucket}
            variant="card"
            bucket={row.bucket}
            name={row.name}
            note={row.note}
            amount={row.amount}
            // S6: money waiting in Invest opens the handoff.
            onPress={
              row.bucket === 'invest' && row.amount > 0 ? () => router.push('/invest') : undefined
            }
            accessibilityHint={
              row.bucket === 'invest' && row.amount > 0 ? 'Opens how to move it' : undefined
            }
            testID={`money-row-${row.bucket}`}
          />
        ))}
        {/* S6 log: a move stays pending until savings show it gone (Andy, 2026-09-28). */}
        {moving.length ? (
          <View>
            {moving.map((m) => (
              <LedgerRow
                key={m.id}
                surface="dark"
                bucket="invest"
                title={m.title}
                subtitle={m.subtitle}
                value={m.value}
                testID={`money-moving-${m.id}`}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: space[16] }}>
        <SettingsGroup>
          <SettingsRow
            variant="chevron"
            label="All transactions"
            onPress={() => router.push('/money/transactions')}
            last={!(v.showTaxes && v.taxYearLabel)}
            testID="open-transactions"
          />
          {v.showTaxes && v.taxYearLabel ? (
            <SettingsRow
              variant="chevron"
              label={v.taxYearLabel}
              onPress={() => router.push('/money/taxes')}
              last
              testID="open-taxes"
            />
          ) : null}
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
