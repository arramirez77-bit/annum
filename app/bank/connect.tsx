import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  checkCount,
  connectNewBank,
  PLAID_ENV,
  repairConnection,
  type ConnectOutcome,
} from '@/state/bank';
import {
  confirmMessage,
  connectedMessage,
  DIDNT_CONNECT,
  finishLaterMessage,
  problemMessage,
  repairedMessage,
  repairMessage,
  type Message,
} from '@/state/bank-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import { Button, GuardrailNote, ScreenScroll, Text } from '@/ui/components';

type Phase =
  | { kind: 'checking' }
  | { kind: 'message'; message: Message; outcome?: ConnectOutcome['kind'] }
  | { kind: 'working' };

/**
 * Connect a bank (O3, O4 "Add another bank", Settings) or repair one (`?item=`, Reconnect).
 * Before Plaid Link opens it names the cost: "This uses 1 of your 10 bank connections." E4 when
 * Link is closed. Form sheet. docs/05 "Bank connections".
 */
export default function ConnectBank() {
  const { item, from } = useLocalSearchParams<{ item?: string; from?: string }>();
  const connection = useAppStore((s) => s.connections.find((c) => c.itemId === item));
  const demo = useAppStore((s) => s.mode === 'demo');
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  /** Ask the Worker for the count (fresh every time: the other phone may have used one). */
  const ask = useCallback(async (): Promise<Phase> => {
    if (demo) {
      // Demo data is never saved, so a connection made now would have nowhere to go.
      return {
        kind: 'message',
        message: {
          title: 'You’re looking at demo data',
          body: 'Demo data isn’t saved. Pick “Use my data” in Scenarios, then connect a bank.',
        },
        outcome: 'problem',
      };
    }
    const r = await checkCount();
    if (r.kind === 'problem') {
      return { kind: 'message', message: problemMessage(r.problem), outcome: 'problem' };
    }
    return {
      kind: 'message',
      message: connection
        ? repairMessage(connection.institution)
        : confirmMessage(r.status, PLAID_ENV === 'sandbox'),
    };
  }, [connection, demo]);
  const check = () => {
    setPhase({ kind: 'checking' });
    void ask().then(setPhase);
  };

  useEffect(() => {
    void ask().then(setPhase);
    // Ask once when the sheet opens; "Try again" asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (skipLink = false) => {
    setPhase({ kind: 'working' });
    const r = item ? await repairConnection(item) : await connectNewBank({ skipLink });
    const message: Message =
      r.kind === 'connected'
        ? connectedMessage(r.institution, r.transactions)
        : r.kind === 'repaired'
          ? repairedMessage(r.institution)
          : r.kind === 'finish-later'
            ? finishLaterMessage(r.institution)
            : r.kind === 'didnt-connect'
              ? DIDNT_CONNECT
              : problemMessage(r.problem);
    setPhase({ kind: 'message', message, outcome: r.kind });
  };

  const done = () => {
    router.back();
    if (from === 'setup') router.navigate('/accounts');
  };
  const importFile = () => {
    router.back();
    router.push('/import');
  };

  if (phase.kind !== 'message') {
    return (
      <ScreenScroll surface="surface" testID="connect-bank-sheet">
        <Text variant="title2" accessibilityRole="header">
          {item ? 'Reconnect' : 'Connect a bank'}
        </Text>
        <Text tone="secondary" testID="connect-working">
          {phase.kind === 'checking'
            ? 'Checking your bank connections…'
            : 'Bringing in your accounts…'}
        </Text>
      </ScreenScroll>
    );
  }

  const { message, outcome } = phase;
  const isConfirm = message.action === 'connect';
  const settled = outcome === 'connected' || outcome === 'repaired' || outcome === 'finish-later';
  return (
    <ScreenScroll surface="surface" testID="connect-bank-sheet">
      <Text variant="title2" accessibilityRole="header" testID="connect-title">
        {message.title}
      </Text>
      <Text tone="secondary" testID="connect-body">
        {message.body}
      </Text>
      {isConfirm && !item ? (
        <GuardrailNote tone="info">
          Free and read-only. You sign in on your bank’s own page through Plaid; Annum never sees
          your password and can never move money.
        </GuardrailNote>
      ) : null}
      <View style={{ gap: space[8] }}>
        {isConfirm ? (
          <Button
            variant="primary"
            label={item ? 'Continue' : 'Connect'}
            onPress={() => void run()}
            testID="connect-go"
          />
        ) : null}
        {message.action === 'retry' ? (
          <Button
            variant="primary"
            label="Try again"
            onPress={() => void (outcome === 'didnt-connect' ? run() : check())}
            testID="connect-retry"
          />
        ) : null}
        {message.action === 'pair' ? (
          <Button
            variant="primary"
            label="How to pair this phone"
            onPress={() => {
              router.back();
              router.push('/pair');
            }}
            testID="connect-pair"
          />
        ) : null}
        {message.action === 'import' || outcome === 'didnt-connect' ? (
          <Button
            variant={message.action === 'import' ? 'primary' : 'quiet'}
            label={message.action === 'import' ? 'Import a file' : 'Import a file instead'}
            onPress={importFile}
            testID="connect-import"
          />
        ) : null}
        {settled ? (
          <Button variant="primary" label="Done" onPress={done} testID="connect-done" />
        ) : null}
        {isConfirm && !item && PLAID_ENV === 'sandbox' ? (
          <Button
            variant="quiet"
            label="Test bank without Link (development)"
            onPress={() => void run(true)}
            testID="connect-skip-link"
          />
        ) : null}
        {!settled ? (
          <Button
            variant="quiet"
            label="Not now"
            onPress={() => router.back()}
            testID="connect-cancel"
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}
