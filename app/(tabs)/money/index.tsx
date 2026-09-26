import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { formatDollars, formatShortDate, proposedBills } from '@/domain';
import { useMoneyView } from '@/state/hooks';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import {
  BucketBar,
  BucketRow,
  Button,
  GuardrailNote,
  SettingsGroup,
  SettingsRow,
  Text,
} from '@/ui/components';

// 03 Money (+E3 not split yet, P2 salary). docs/05.
export default function MoneyScreen() {
  const v = useMoneyView();
  const deposit = useAppStore((s) => s.data.pendingDeposit);
  const landed = deposit && !deposit.confirmed ? deposit : undefined;
  const toReview = useAppStore((s) => proposedBills(s.data.bills).length);

  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingTop: space[16],
        paddingBottom: space[24],
        paddingHorizontal: layout.screenMargin,
        gap: space[24],
      }}
      testID="money"
    >
      <View style={{ gap: space[4] }}>
        <Text variant="title1" accessibilityRole="header">
          Money
        </Text>
        <Text tone="secondary">Where every dollar in savings is spoken for.</Text>
      </View>

      <View style={{ gap: space[12] }}>
        <View
          accessible
          accessibilityLabel={`Savings, ${formatDollars(v.savings)}`}
          style={{ gap: space[2] }}
        >
          <Text variant="footnote" tone="secondary">
            Savings
          </Text>
          <Text variant="title2" money testID="money-savings">
            {formatDollars(v.savings)}
          </Text>
        </View>
        <BucketBar segments={v.segments} muted={v.unsplit} accessibilityLabel={v.barLabel} />
      </View>

      {v.unsplit && v.previewNote ? (
        <View style={{ gap: space[12] }}>
          <GuardrailNote tone="info" testID="unsplit-preview">
            {v.previewNote}
          </GuardrailNote>
          <Button
            variant="primary"
            label="Split my savings now"
            onPress={() => router.push('/deposit/unsplit/setup')}
            testID="split-now"
          />
        </View>
      ) : null}

      {landed && !v.unsplit ? (
        <View style={{ gap: space[12] }}>
          <GuardrailNote tone="info" testID="deposit-landed">
            {`${formatDollars(landed.amount)}${landed.source ? ` from ${landed.source}` : ''} landed ${formatShortDate(landed.date)}. Split it so every dollar has a job.`}
          </GuardrailNote>
          <Button
            variant="primary"
            label="Split it"
            onPress={() => router.push(`/deposit/${landed.id}`)}
            testID="split-deposit"
          />
        </View>
      ) : null}

      <View style={{ gap: space[8] }}>
        {v.rows.map((row) => (
          <BucketRow
            key={row.bucket}
            variant="card"
            bucket={row.bucket}
            name={row.name}
            note={row.note}
            amount={row.amount}
            testID={`money-row-${row.bucket}`}
          />
        ))}
      </View>

      <SettingsGroup>
        <SettingsRow
          variant="chevron"
          label="All transactions"
          onPress={() => router.push('/money/transactions')}
          testID="open-transactions"
        />
        <SettingsRow
          variant="value"
          label="Bills"
          value={toReview ? `${toReview} to look at` : ''}
          onPress={() => router.push('/bills')}
          testID="open-bills"
        />
        <SettingsRow
          variant="chevron"
          label="Import a file"
          onPress={() => router.push('/import')}
          last={!v.showTaxes}
          testID="open-import"
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
    </ScrollView>
  );
}
