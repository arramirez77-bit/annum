import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { deleteEverything } from '@/state/session';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  Text,
  TextField,
} from '@/ui/components';

const GOES = [
  'Balances, transactions and buckets',
  'Your numbers, rules and weekly reviews',
  'Reminders',
  'The key that unlocks your data',
];

// S8 Delete everything (modal). docs/05, docs/02 "Delete everything".
export default function DeleteEverything() {
  const demo = useAppStore((s) => s.mode === 'demo');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
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
          {GOES.map((g, i) => (
            <LedgerRow key={g} surface="dark" title={g} last={i === GOES.length - 1} />
          ))}
        </View>
        <GuardrailNote tone="heads-up">
          {demo
            ? 'You’re looking at demo data, which isn’t saved. Pick “Use my data” in Scenarios first.'
            : 'This can’t be undone. If you might want this data later, export it first.'}
        </GuardrailNote>
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
