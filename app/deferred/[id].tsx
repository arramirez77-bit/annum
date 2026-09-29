import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { buildDeferredView } from '@/state/invest-views';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Button, LedgerRow, Text } from '@/ui/components';

/** S7 Waited-on purchase (form sheet, Figma 65:864): after an invoice lands. */
export default function WaitedOnPurchase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppStore((s) => s.data);
  const purchase = useAppStore((s) => s.deferred.find((d) => d.id === id));
  const resolveDeferred = useAppStore((s) => s.resolveDeferred);
  const waitAgain = useAppStore((s) => s.waitAgain);
  const sheet = {
    paddingTop: space[28],
    paddingHorizontal: layout.screenMargin,
    paddingBottom: space[40],
    gap: space[16],
  };

  if (!purchase || purchase.status !== 'waiting') {
    return (
      <View style={[{ flex: 1, backgroundColor: color.bgSurface }, sheet]}>
        <Text variant="callout" tone="secondary" align="center">
          You already decided on this purchase.
        </Text>
        <Button variant="secondary" label="Close" onPress={() => router.back()} />
      </View>
    );
  }

  const v = buildDeferredView(data, purchase);
  return (
    <ScrollView
      style={{ backgroundColor: color.bgSurface }}
      contentContainerStyle={sheet}
      testID="deferred"
    >
      <View style={{ gap: space[8] }}>
        <Text variant="title2" align="center" accessibilityRole="header">
          {v.title}
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          {v.sentence}
        </Text>
      </View>
      <View>
        {v.rows.map((r) => (
          <LedgerRow
            key={r.title}
            surface="dark"
            title={r.title}
            subtitle={r.subtitle}
            value={r.value}
          />
        ))}
      </View>
      <Button
        variant="primary"
        label={v.primary}
        onPress={() => {
          resolveDeferred(purchase.id, 'bought');
          router.back();
        }}
        testID="deferred-buy"
      />
      <Button
        variant="secondary"
        label={v.secondary}
        onPress={() => {
          waitAgain(purchase.id, v.waitUntil);
          router.back();
        }}
        testID="deferred-wait"
      />
      <Button
        variant="quiet"
        label={v.quiet}
        onPress={() => {
          resolveDeferred(purchase.id, 'dropped');
          router.back();
        }}
        testID="deferred-drop"
      />
    </ScrollView>
  );
}
