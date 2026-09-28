import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { checkCount, endConnectionsAtPlaid, useBank } from '@/state/bank';
import { countLabel } from '@/state/bank-views';
import { deleteEverything } from '@/state/session';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  SettingsGroup,
  SettingsRow,
  Text,
  TextField,
} from '@/ui/components';

const GOES = [
  'Balances, transactions and buckets',
  'Your numbers, rules and weekly reviews',
  'Reminders',
  'The key that unlocks your data',
];
const BANK_GOES = ['Bank connections on this phone', 'This phone’s access code'];

// S8 Delete everything (modal). docs/05, docs/02 "Delete everything".
export default function DeleteEverything() {
  const demo = useAppStore((s) => s.mode === 'demo');
  const banks = useAppStore((s) => s.connections.filter((c) => c.status !== 'exchanging').length);
  const count = useBank((s) => s.count);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [endAtPlaid, setEndAtPlaid] = useState(false);
  const goes = banks ? [...GOES, ...BANK_GOES] : GOES;
  useEffect(() => {
    if (banks && !demo) void checkCount();
  }, [banks, demo]);
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Delete everything',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} testID="delete-cancel" />
          ),
        }}
      />
      <ScreenScroll testID="delete-everything">
        <Text tone="secondary">This removes from this phone:</Text>
        <View>
          {goes.map((g, i) => (
            <LedgerRow key={g} surface="dark" title={g} last={i === goes.length - 1} />
          ))}
        </View>
        <GuardrailNote tone="heads-up">
          {demo
            ? 'You’re looking at demo data, which isn’t saved. Pick “Use my data” in Scenarios first.'
            : 'This can’t be undone. If you might want this data later, export it first.'}
        </GuardrailNote>
        {banks && !demo ? (
          <>
            <GuardrailNote tone="heads-up" testID="delete-banks-note">
              {`Reconnecting banks later uses new connections — ${countLabel(count)} for both phones. A backup brings these connections back without using any.`}
            </GuardrailNote>
            <SettingsGroup>
              <SettingsRow
                variant="toggle"
                label="Also end my bank connections at Plaid"
                value={endAtPlaid}
                onValueChange={setEndAtPlaid}
                testID="delete-end-at-plaid"
                last
              />
            </SettingsGroup>
            {endAtPlaid ? (
              <Text variant="footnote" tone="secondary">
                Ended connections still count against the 10, and a backup can’t bring them back.
              </Text>
            ) : null}
          </>
        ) : null}
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          testID="delete-confirm-field"
        />
        <View style={{ gap: space[8] }}>
          <Button
            variant="secondary"
            label="Export my data first"
            disabled={demo}
            onPress={() => router.push('/settings/export')}
            testID="delete-export"
          />
          <Button
            variant="destructive"
            label={busy ? 'Deleting…' : 'Delete everything'}
            disabled={demo || typed.trim() !== 'DELETE' || busy}
            onPress={async () => {
              setBusy(true);
              if (endAtPlaid) await endConnectionsAtPlaid();
              router.dismissAll();
              await deleteEverything();
            }}
            testID="delete-confirm"
          />
        </View>
      </ScreenScroll>
    </>
  );
}
