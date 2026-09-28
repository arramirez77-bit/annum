import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isPairingKey, pairWith, useBank, type PairResult } from '@/state/bank';
import { countLabel } from '@/state/bank-views';
import { takeWaitingKey } from '@/state/pairing';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import { Button, GuardrailNote, HeaderButton, ScreenScroll, Text } from '@/ui/components';

type State = 'instructions' | 'checking' | 'invalid' | PairResult;

const STEPS = [
  'On the laptop, in the annum folder, run “npm run worker:rotate-key”.',
  'Point this iPhone’s Camera at the code and tap “Open in Annum”.',
];

/**
 * Pair this phone: opened by the QR code from `npm run worker:rotate-key` (annum://pair?key=…),
 * or from Settings to see how. Saves the key in the Keychain (this device only) after Annum is
 * unlocked, then checks it with the Worker. Bank connections don't change. docs/05.
 */
export default function Pair() {
  const phase = useAppStore((s) => s.phase);
  const hasBanks = useAppStore((s) => s.connections.length > 0);
  const count = useBank((s) => s.count);
  const [state, setState] = useState<State>('instructions');

  useEffect(() => {
    // Behind the Face ID lock, wait: the key is saved once the owner is in.
    if (phase !== 'ready' && phase !== 'onboarding') return;
    const key = takeWaitingKey();
    if (!key) return;
    const pair = async () => {
      if (!isPairingKey(key)) {
        setState('invalid');
        return;
      }
      setState('checking');
      setState(await pairWith(key));
    };
    void pair();
  }, [phase]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const title =
    state === 'paired'
      ? hasBanks
        ? 'This phone can reach your banks again'
        : 'This phone is paired'
      : state === 'checking'
        ? 'Checking the code…'
        : 'Pair this phone';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Pair this phone',
          headerLeft: () => <HeaderButton label="Close" onPress={close} testID="pair-close" />,
        }}
      />
      <ScreenScroll testID="pair">
        <Text variant="title2" accessibilityRole="header" testID="pair-title">
          {title}
        </Text>
        {state === 'paired' ? (
          <Text tone="secondary" testID="pair-result">
            {`Nothing about your bank connections changed. ${countLabel(count)} for both phones.`}
          </Text>
        ) : null}
        {state === 'refused' ? (
          <GuardrailNote tone="heads-up" testID="pair-result">
            That code has already been replaced. Scan the newest code from your laptop.
          </GuardrailNote>
        ) : null}
        {state === 'invalid' ? (
          <GuardrailNote tone="heads-up" testID="pair-result">
            That doesn’t look like an Annum code. Scan the code from your laptop again.
          </GuardrailNote>
        ) : null}
        {state === 'offline' || state === 'unavailable' ? (
          <GuardrailNote tone="info" testID="pair-result">
            {state === 'offline'
              ? 'Saved. Annum will check the code when this phone is back online.'
              : 'Saved. Annum couldn’t check it just now and will try again later.'}
          </GuardrailNote>
        ) : null}
        {state === 'instructions' || state === 'refused' || state === 'invalid' ? (
          <>
            <Text tone="secondary">
              Annum reaches your banks through a small private service, and each phone needs its
              access code once.
            </Text>
            <View style={{ gap: space[12] }}>
              {STEPS.map((step, i) => (
                <Text key={step}>{`${i + 1}. ${step}`}</Text>
              ))}
            </View>
            <GuardrailNote tone="info">
              A new code replaces the old one on every phone, so scan it on each phone you use. Your
              bank connections stay as they are.
            </GuardrailNote>
          </>
        ) : null}
        <Button
          variant={state === 'instructions' ? 'secondary' : 'primary'}
          label="Done"
          onPress={close}
          testID="pair-done"
        />
      </ScreenScroll>
    </>
  );
}
