import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lockCapability, type LockCapability } from '@/services/lock';
import { backToMyData, boot, deleteEverything, unlock } from '@/state/session';
import { useAppStore, type Blocked } from '@/state/store';
import { color, layout, size, space } from '@/theme';
import { Button, Mark, Text } from '@/ui/components';
import { DevEntry } from '@/ui/flows/DevEntry';

import { RestoreForm } from './RestoreForm';

const UNLOCK_LABEL: Record<LockCapability, string> = {
  'face-id': 'Unlock with Face ID',
  'touch-id': 'Unlock with Touch ID',
  passcode: 'Unlock with passcode',
  none: 'Open Annum',
};

/**
 * Covers the app while it starts, while it's locked (S5 / E6), or when this phone can't open
 * its data. Sits above every screen; VoiceOver stays inside it.
 */
export function Gate() {
  const phase = useAppStore((s) => s.phase);
  const blocked = useAppStore((s) => s.blocked);
  if (phase !== 'booting' && phase !== 'locked' && phase !== 'blocked') return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color.bgBase }]}
      accessibilityViewIsModal
      testID={`gate-${phase}`}
    >
      {phase === 'locked' ? <LockScreen /> : null}
      {phase === 'blocked' && blocked ? <BlockedScreen reason={blocked} /> : null}
    </View>
  );
}

function LockScreen() {
  const insets = useSafeAreaInsets();
  const [capability, setCapability] = useState<LockCapability>('face-id');
  const [notRecognized, setNotRecognized] = useState(false);
  /** iOS runs its own "Try Face ID Again" loop and reports a plain cancel, so after any
   * unsuccessful try the passcode is offered too. */
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);

  const tryUnlock = async (allowPasscode: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await unlock(allowPasscode);
      if (result === 'not-recognized') setNotRecognized(true);
      if (result === 'use-passcode') await unlock(true);
      else if (result !== 'unlocked' && result !== 'no-protection') setTried(true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void lockCapability().then(setCapability);
    if (!prompted.current) {
      prompted.current = true;
      void tryUnlock(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + space[72],
        paddingBottom: insets.bottom + space[24],
        paddingHorizontal: layout.screenMargin,
        justifyContent: 'space-between',
      }}
      testID="lock-screen"
    >
      <View style={{ alignItems: 'center', gap: space[24] }}>
        <DevEntry>
          <Mark size={size.markLockup} />
        </DevEntry>
        <Text variant="title2" align="center" accessibilityRole="header">
          Your money stays on this phone.
        </Text>
        {notRecognized ? (
          <Text tone="secondary" align="center" testID="lock-not-recognized">
            {capability === 'touch-id'
              ? 'Touch ID didn’t recognize you.'
              : 'Face ID didn’t recognize you.'}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: space[8] }}>
        <Button
          variant="secondary"
          label={UNLOCK_LABEL[capability]}
          onPress={() => void tryUnlock(capability === 'passcode')}
          testID="lock-unlock"
        />
        {(notRecognized || tried) && capability !== 'passcode' ? (
          <Button
            variant="quiet"
            label="Use passcode"
            onPress={() => void tryUnlock(true)}
            testID="lock-passcode"
          />
        ) : null}
      </View>
    </View>
  );
}

const BLOCKED: Record<Blocked, { title: string; body: string }> = {
  'key-missing': {
    title: 'Annum can’t open the data on this phone',
    body: 'The key that unlocks it never leaves the phone it was made on, and it isn’t here. That happens when a phone is set up from an iCloud backup. Restore an Annum backup file, or start fresh.',
  },
  newer: {
    title: 'This data is from a newer Annum',
    body: 'It was saved by a newer version of Annum than this one. Update Annum from TestFlight to open it. Nothing was changed.',
  },
  'cant-open': {
    title: 'Annum couldn’t open your data',
    body: 'Nothing was changed. Try again, and if it keeps happening, restore an Annum backup file or start fresh.',
  },
};

function BlockedScreen({ reason }: { reason: Blocked }) {
  const insets = useSafeAreaInsets();
  const [restoring, setRestoring] = useState(false);
  const copy = BLOCKED[reason];
  const startFresh = () =>
    Alert.alert(
      'Start fresh?',
      'This removes the data Annum can’t open from this phone and starts setup again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: () => void deleteEverything() },
      ],
    );
  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + space[48],
        paddingBottom: insets.bottom + space[24],
        paddingHorizontal: layout.screenMargin,
        gap: space[20],
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      testID="blocked-screen"
    >
      <DevEntry>
        <Mark size={size.markLockup} />
      </DevEntry>
      <Text variant="title2" accessibilityRole="header">
        {copy.title}
      </Text>
      <Text tone="secondary">{copy.body}</Text>
      {restoring ? (
        <RestoreForm replaces={false} onDone={() => setRestoring(false)} />
      ) : (
        <View style={{ gap: space[8] }}>
          {reason === 'cant-open' ? (
            <Button variant="primary" label="Try again" onPress={() => void boot()} />
          ) : null}
          {reason !== 'newer' ? (
            <Button
              variant={reason === 'cant-open' ? 'secondary' : 'primary'}
              label="Restore from a backup"
              onPress={() => setRestoring(true)}
              testID="blocked-restore"
            />
          ) : null}
          {reason !== 'newer' ? (
            <Button
              variant="quiet"
              label="Start fresh"
              onPress={startFresh}
              testID="blocked-fresh"
            />
          ) : null}
          {__DEV__ ? (
            <Button
              variant="quiet"
              label="Use my data (retry)"
              onPress={() => void backToMyData()}
            />
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
