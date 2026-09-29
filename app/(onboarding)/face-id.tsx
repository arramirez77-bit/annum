import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { authenticate, lockCapability, type LockCapability } from '@/services/lock';
import { useOnboarding } from '@/state/onboarding';
import { color, space, symbols } from '@/theme';
import { Button, GuardrailNote, Icon, ScreenScroll, Text } from '@/ui/components';

const NAME: Record<LockCapability, string> = {
  'face-id': 'Face ID',
  'touch-id': 'Touch ID',
  passcode: 'your passcode',
  none: 'Face ID',
};

// O4b Keep it private with Face ID. docs/05.
export default function FaceId() {
  const setLock = useOnboarding((s) => s.setLock);
  const [capability, setCapability] = useState<LockCapability | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void lockCapability().then(setCapability);
  }, []);
  const name = NAME[capability ?? 'face-id'];

  const turnOn = async () => {
    setProblem(null);
    // One check now: iOS asks permission the first time, and it proves the lock will open.
    const result = await authenticate(capability === 'passcode');
    if (
      result === 'unlocked' ||
      (result === 'use-passcode' && (await authenticate(true)) === 'unlocked')
    ) {
      setLock(true);
      router.push('/reminders');
    } else if (result !== 'cancelled') {
      setProblem(
        'That didn’t work, so the lock is still off. You can try again or turn it on later in Settings.',
      );
    }
  };

  return (
    // O4b (Figma 98:1195).
    <ScreenScroll testID="onboarding-face-id" fill>
      <Icon name={symbols.lock} size="feature" tint={color.textPrimary} />
      <Text variant="title2" accessibilityRole="header">
        Keep it private with {name}
      </Text>
      <Text variant="callout" tone="secondary">
        Annum opens with {name}, like your banking apps. Your data is encrypted on this phone.
      </Text>
      {name !== 'your passcode' ? (
        <Text variant="footnote" tone="secondary">
          If {name} doesn’t recognize you, your iPhone passcode works too.
        </Text>
      ) : null}
      {capability === 'none' ? (
        <GuardrailNote tone="heads-up">
          This iPhone has no Face ID or passcode set up, so there’s nothing to lock with. You can
          turn the lock on in Settings after setting one up.
        </GuardrailNote>
      ) : null}
      {problem ? <GuardrailNote tone="heads-up">{problem}</GuardrailNote> : null}
      <View style={{ flex: 1 }} />
      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label={capability === 'passcode' ? 'Turn on the lock' : `Turn on ${name}`}
          disabled={capability === 'none' || capability === null}
          onPress={() => void turnOn()}
          testID="face-id-on"
        />
        <Button
          variant="quiet"
          label="Not now"
          onPress={() => {
            setLock(false);
            router.push('/reminders');
          }}
          testID="face-id-later"
        />
      </View>
    </ScreenScroll>
  );
}
