import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { endConnectionsAtPlaid } from '@/state/bank';
import { notEndedNote } from '@/state/bank-views';
import { deleteEverything } from '@/state/session';
import { buildDeleteView } from '@/state/settings-views';
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

// S8 Delete everything (modal). docs/05, docs/02 "Delete everything".
export default function DeleteEverything() {
  const data = useAppStore((s) => s.data);
  const demo = useAppStore((s) => s.mode === 'demo');
  const banks = useAppStore((s) => s.connections.filter((c) => c.status !== 'exchanging').length);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [endAtPlaid, setEndAtPlaid] = useState(false);
  const [notEnded, setNotEnded] = useState(0);
  const v = buildDeleteView(data, demo ? 0 : banks, endAtPlaid);
  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <HeaderButton label="Cancel" onPress={() => router.back()} testID="delete-cancel" />
          ),
        }}
      />
      {/* S8 (Figma 71:1066). */}
      <ScreenScroll testID="delete-everything">
        <Text variant="title2" accessibilityRole="header">
          Delete everything?
        </Text>
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
        {banks && !demo ? (
          <View style={{ gap: space[8] }}>
            <SettingsGroup>
              <SettingsRow
                variant="toggle"
                label="End my bank logins at Plaid too"
                value={endAtPlaid}
                onValueChange={setEndAtPlaid}
                testID="delete-end-at-plaid"
                last
              />
            </SettingsGroup>
            <Text
              variant="footnote"
              tone="secondary"
              accessibilityLiveRegion="polite"
              testID="delete-banks-note"
            >
              {v.bankLine}
            </Text>
          </View>
        ) : null}
        {notEnded > 0 ? (
          <GuardrailNote tone="heads-up" testID="delete-not-ended">
            {notEndedNote(notEnded)}
          </GuardrailNote>
        ) : null}
        <GuardrailNote tone="heads-up">
          {demo
            ? 'You’re looking at demo data, which isn’t saved. Pick “Use my data” in Scenarios first.'
            : 'This can’t be undone. Export first if you want a copy for your accountant.'}
        </GuardrailNote>
        <TextField
          label="Type DELETE to confirm"
          value={typed}
          onChangeText={setTyped}
          placeholder="DELETE"
          helper="Deletes everything from this phone. Your iCloud backup can’t open it without this phone’s key."
          autoCapitalize="characters"
          large
          testID="delete-confirm-field"
        />
        <View style={{ gap: space[20], marginTop: space[8] }}>
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
              setNotEnded(0);
              if (endAtPlaid) {
                // Deleting can't be undone: if any connection is still live at Plaid, stop here.
                const r = await endConnectionsAtPlaid();
                if (r.notEnded > 0) {
                  setNotEnded(r.notEnded);
                  setBusy(false);
                  return;
                }
              }
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
