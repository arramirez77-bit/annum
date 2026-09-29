import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { editSplit, type EditableBucket, type Split } from '@/domain';
import { buildSplitView, initialSplit, SPLIT_EDIT } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { BucketBar, BucketRow, Button, GuardrailNote, Text } from '@/ui/components';

/**
 * 09 Deposit split and S14 first split (form sheet, Figma 58:137 / 129:1771), with 09b
 * "Change the split" (129:1913). Free absorbs every edit; the total never changes. docs/03.
 */
export default function DepositSplit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppStore((s) => s.data);
  const confirmDeposit = useAppStore((s) => s.confirmDeposit);
  const [suggested] = useState<Split | undefined>(() => initialSplit(data, id));
  const [split, setSplit] = useState<Split | undefined>(suggested);
  const [editing, setEditing] = useState(false);
  const [capped, setCapped] = useState(false);

  const sheet = {
    paddingTop: space[28],
    paddingHorizontal: layout.screenMargin,
    paddingBottom: space[40],
    gap: space[16],
  };

  if (!split) {
    return (
      <View style={[{ flex: 1, backgroundColor: color.bgSurface }, sheet]}>
        <Text variant="title2" align="center" accessibilityRole="header">
          Nothing to split
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          This deposit is already split, so there’s nothing left to do here.
        </Text>
        <Button variant="secondary" label="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const v = buildSplitView(data, id, split);
  const unsplit = id === 'unsplit';
  const stopEditing = () => {
    setEditing(false);
    setCapped(false);
  };
  return (
    <ScrollView
      style={{ backgroundColor: color.bgSurface }}
      contentContainerStyle={sheet}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID="deposit-split"
    >
      <View style={{ gap: space[4] }}>
        <Text variant="title2" money align="center" accessibilityRole="header">
          {editing ? SPLIT_EDIT.title : v.title}
        </Text>
        <Text variant="callout" tone="secondary" align="center" testID="deposit-subtitle">
          {editing ? SPLIT_EDIT.subtitle : v.subtitle}
        </Text>
      </View>
      <BucketBar segments={v.segments} accessibilityLabel={v.barLabel} />
      <View>
        {v.rows.map((row) => (
          <BucketRow
            key={row.bucket}
            variant="split"
            bucket={row.bucket}
            name={row.name}
            note={row.note}
            amount={row.amount}
            testID={`deposit-${row.bucket}`}
            onPressAmount={editing ? undefined : () => setEditing(true)}
            onChangeAmount={
              editing && row.bucket !== 'free'
                ? (cents) => {
                    const edit = editSplit(split, row.bucket as EditableBucket, cents);
                    setSplit(edit.split);
                    setCapped(edit.capped);
                  }
                : undefined
            }
          />
        ))}
      </View>
      {editing && capped ? (
        <GuardrailNote tone="heads-up">{SPLIT_EDIT.capped}</GuardrailNote>
      ) : (
        <GuardrailNote tone="info">{editing ? SPLIT_EDIT.note : v.note}</GuardrailNote>
      )}
      {editing ? (
        <>
          <Button
            variant="primary"
            label={SPLIT_EDIT.primary}
            onPress={stopEditing}
            testID="split-save"
          />
          <Button
            variant="quiet"
            label={SPLIT_EDIT.quiet}
            onPress={() => {
              setSplit(suggested);
              stopEditing();
            }}
            testID="split-suggested"
          />
        </>
      ) : (
        <>
          <Button
            variant="primary"
            label={v.primary}
            onPress={() => {
              confirmDeposit(split, !unsplit);
              const after = useAppStore.getState();
              const waiting = after.deferred.find((d) => d.status === 'waiting');
              // After an invoice lands: a purchase you waited on (S7), else money to invest (S6).
              if (!unsplit && waiting) router.replace(`/deferred/${waiting.id}`);
              else if (split.invest > 0 && after.data.buckets.invest > 0) {
                router.replace({ pathname: '/invest', params: { from: 'deposit' } });
              } else router.back();
            }}
            testID="deposit-confirm"
          />
          <Button
            variant="quiet"
            label={v.quiet}
            onPress={unsplit ? () => router.back() : () => setEditing(true)}
            testID={unsplit ? 'deposit-not-now' : 'deposit-edit'}
          />
        </>
      )}
    </ScrollView>
  );
}
