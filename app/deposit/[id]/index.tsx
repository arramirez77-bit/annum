import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { editSplit, type EditableBucket, type Split } from '@/domain';
import { buildSplitView, initialSplit } from '@/state/review-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { BucketBar, BucketRow, Button, GuardrailNote, Text } from '@/ui/components';

// 09 Deposit split (form sheet). Free absorbs every edit; the total never changes. docs/03, docs/05.
export default function DepositSplit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppStore((s) => s.data);
  const confirmDeposit = useAppStore((s) => s.confirmDeposit);
  const [split, setSplit] = useState<Split | undefined>(() => initialSplit(data, id));
  const [editing, setEditing] = useState(false);
  const [capped, setCapped] = useState(false);

  if (!split) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.bgSurface,
          padding: layout.screenMargin,
          gap: space[12],
        }}
      >
        <Text variant="title2">Nothing to split</Text>
        <Text tone="secondary">
          This deposit is already split, so there’s nothing left to do here.
        </Text>
        <Button variant="secondary" label="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const v = buildSplitView(data, id, split);
  return (
    <ScrollView
      style={{ backgroundColor: color.bgSurface }}
      contentContainerStyle={{
        padding: layout.screenMargin,
        gap: space[16],
        paddingBottom: space[40],
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID="deposit-split"
    >
      <View style={{ gap: space[4] }}>
        <Text variant="title2" money accessibilityRole="header">
          {v.title}
        </Text>
        {v.subtitle ? <Text tone="secondary">{v.subtitle}</Text> : null}
      </View>
      <BucketBar segments={v.segments} accessibilityLabel={v.barLabel} />
      <View style={{ gap: space[8] }}>
        {v.rows.map((row) => (
          <BucketRow
            key={row.bucket}
            variant="split"
            bucket={row.bucket}
            name={row.name}
            note={row.note}
            amount={row.amount}
            testID={`deposit-${row.bucket}`}
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
      {capped ? (
        <GuardrailNote tone="heads-up">
          That’s more than this deposit has left, so it stops at what fits.
        </GuardrailNote>
      ) : (
        <GuardrailNote tone="info">{v.note}</GuardrailNote>
      )}
      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label={v.primary}
          onPress={() => {
            confirmDeposit(split, id !== 'unsplit');
            router.back();
          }}
          testID="deposit-confirm"
        />
        <Button
          variant="quiet"
          label={editing ? 'Done editing' : v.quiet}
          onPress={() => setEditing((e) => !e)}
          testID="deposit-edit"
        />
      </View>
    </ScrollView>
  );
}
