import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { remindTomorrow } from '@/services/notifications';
import {
  buildInvestView,
  buildMovedView,
  investDestination,
  savingsSource,
} from '@/state/invest-views';
import { useAppStore } from '@/state/store';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  Text,
} from '@/ui/components';

/**
 * S6 Invest handoff (modal, Figma 65:829). "I moved it" empties Invest and logs the move as
 * pending until savings show it gone; an account entered by hand gets a one-tap add, never an
 * automatic one (Andy, 2026-09-28). `from=deposit`: opened right after a split.
 */
export default function InvestHandoff() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const data = useAppStore((s) => s.data);
  const connections = useAppStore((s) => s.connections);
  const markInvestMoved = useAppStore((s) => s.markInvestMoved);
  const addToBalance = useAppStore((s) => s.addToBalance);
  const [movedId, setMovedId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const move = useAppStore((s) => s.investMoves.find((m) => m.id === movedId));
  const v = buildInvestView(data, from === 'deposit');
  const close = () => router.back();

  const header = (
    <Stack.Screen
      options={{
        title: '',
        headerLeft: () => <HeaderButton label="Close" onPress={close} testID="invest-close" />,
      }}
    />
  );

  if (move) {
    const m = buildMovedView(data, move);
    return (
      <>
        {header}
        <ScreenScroll testID="invest-moved" fill>
          <Text variant="title2" accessibilityRole="header">
            {m.title}
          </Text>
          <Text variant="callout" tone="secondary">
            {m.line}
          </Text>
          {m.add && !added ? (
            <Button
              variant="secondary"
              label={m.add}
              onPress={() => {
                if (move.toAccountId) addToBalance(move.toAccountId, move.amount);
                setAdded(true);
              }}
              testID="invest-add-balance"
            />
          ) : null}
          {added && m.added ? (
            <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
              {m.added}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button variant="primary" label="Done" onPress={close} testID="invest-done" />
        </ScreenScroll>
      </>
    );
  }

  if (v.empty) {
    return (
      <>
        {header}
        <ScreenScroll testID="invest-empty">
          <Text variant="callout" tone="secondary">
            Nothing is waiting to be invested right now. When a deposit fills Runway, what’s left
            after taxes, bills and Free shows up here.
          </Text>
        </ScreenScroll>
      </>
    );
  }

  const destination = investDestination(data);
  return (
    <>
      {header}
      <ScreenScroll testID="invest" fill>
        <Text variant="subhead" tone="secondary">
          {v.label}
        </Text>
        <Text variant="hero" money accessibilityRole="header">
          {v.amount}
        </Text>
        <Text variant="sentence">{v.sentence}</Text>
        <View>
          {v.rows.map((r) => (
            <LedgerRow
              key={r.title}
              surface="dark"
              bucket={r.bucket}
              title={r.title}
              subtitle={r.subtitle}
              value={r.value}
            />
          ))}
        </View>
        <GuardrailNote tone="info">{v.note}</GuardrailNote>
        {note ? (
          <GuardrailNote tone="heads-up" testID="invest-note">
            {note}
          </GuardrailNote>
        ) : null}
        <View style={{ flex: 1 }} />
        <Button
          variant="primary"
          label={v.primary}
          onPress={() => {
            const m = markInvestMoved({
              to: destination.name,
              toAccountId: destination.accountId,
              from: savingsSource(data, connections),
            });
            if (m) setMovedId(m.id);
          }}
          testID="invest-moved-it"
        />
        <Button
          variant="quiet"
          label={v.quiet}
          onPress={async () => {
            const ok = await remindTomorrow('invest', {
              title: 'Ready to invest',
              body: `Move it in ${destination.name}, then mark it in Annum.`,
              url: '/invest',
            }).catch(() => false);
            if (ok) close();
            else setNote('Reminders are off for Annum in iOS Settings → Notifications.');
          }}
          testID="invest-remind"
        />
      </ScreenScroll>
    </>
  );
}
