import { router } from 'expo-router';
import { View } from 'react-native';

import { buildBillsView } from '@/state/bills-views';
import { useAppStore } from '@/state/store';
import { color, radius, space } from '@/theme';
import { Button, GuardrailNote, LedgerRow, ScreenScroll, Text } from '@/ui/components';

// Bills (from Money → Bills and Settings): confirmed bills, and the ones Annum noticed.
export default function Bills() {
  const data = useAppStore((s) => s.data);
  const confirmBill = useAppStore((s) => s.confirmBill);
  const dismissBill = useAppStore((s) => s.dismissBill);
  const v = buildBillsView(data);
  const edit = (id: string) => router.push({ pathname: '/bill/[id]', params: { id } });

  return (
    <ScreenScroll testID="bills">
      <Text tone="secondary">{v.note}</Text>
      {v.empty ? <GuardrailNote tone="info">{v.empty}</GuardrailNote> : null}
      {v.proposals.length ? (
        <View style={{ gap: space[8] }}>
          <Text variant="headline" accessibilityRole="header">
            Annum noticed these
          </Text>
          {v.proposals.map((p) => (
            <View
              key={p.id}
              testID={`proposal-${p.id}`}
              style={{
                gap: space[12],
                padding: space[16],
                borderRadius: radius.lg,
                backgroundColor: color.bgSurface,
              }}
            >
              <View style={{ gap: space[4] }}>
                <Text variant="headline">{p.title}</Text>
                <Text variant="callout" tone="secondary">
                  {p.subtitle}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space[8] }}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="secondary"
                    label="It’s a bill"
                    onPress={() => confirmBill(p.id)}
                    testID={`confirm-${p.id}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="quiet"
                    label="Not a bill"
                    onPress={() => dismissBill(p.id)}
                    testID={`dismiss-${p.id}`}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {v.confirmed.length ? (
        <View>
          {v.confirmed.map((b, i) => (
            <LedgerRow
              key={b.id}
              surface="dark"
              title={b.title}
              subtitle={b.subtitle}
              value={b.value}
              onPress={() => edit(b.id)}
              last={i === v.confirmed.length - 1}
              testID={`bill-${b.id}`}
            />
          ))}
        </View>
      ) : null}
      <Button
        variant="secondary"
        label="Add a bill"
        onPress={() => edit('new')}
        testID="bill-add"
      />
    </ScreenScroll>
  );
}
