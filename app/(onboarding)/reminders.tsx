import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { askForReminders } from '@/services/notifications';
import { useOnboarding } from '@/state/onboarding';
import { finishOnboarding } from '@/state/session';
import { space } from '@/theme';
import {
  Button,
  GuardrailNote,
  HeaderButton,
  LedgerRow,
  ScreenScroll,
  StepLabel,
  Text,
} from '@/ui/components';

// O4c Want a few reminders? (Step 4 of 4, Figma 98:1229) → Today in estimate state. docs/05, docs/02 "Notifications".
export default function Reminders() {
  const incomeType = useOnboarding((s) => s.incomeType);
  const setReminders = useOnboarding((s) => s.setReminders);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const rows = [
    { title: 'Weekly review', subtitle: 'Sundays at 10 AM. Takes about 10 minutes.' },
    { title: 'Card statements', subtitle: 'Two days before they’re due' },
    ...(incomeType === 'salary'
      ? []
      : [{ title: 'Quarterly taxes', subtitle: 'A week before each payment' }]),
    incomeType === 'salary'
      ? { title: 'Paydays', subtitle: 'When your paycheck lands' }
      : { title: 'Deposits and late invoices', subtitle: 'When money lands or an invoice is late' },
  ];

  const finish = async (on: boolean) => {
    setBusy(true);
    setProblem(false);
    try {
      const granted = on ? await askForReminders().catch(() => false) : false;
      setReminders(granted);
      if (!(await finishOnboarding({ ...useOnboarding.getState(), reminders: granted }))) {
        setProblem(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <StepLabel step={4} total={4} />,
          headerRight: () => (
            <HeaderButton
              label="Skip"
              onPress={() => {
                if (!busy) void finish(false);
              }}
              testID="onboarding-skip"
            />
          ),
        }}
      />
      <ScreenScroll testID="onboarding-reminders">
        <View style={{ gap: space[4] }}>
          <Text variant="title2" accessibilityRole="header">
            Want a few reminders?
          </Text>
          <Text variant="callout" tone="secondary">
            Annum only reminds you when something needs you. You can change these later in Settings.
          </Text>
        </View>
        <View>
          {rows.map((r) => (
            <LedgerRow key={r.title} surface="dark" title={r.title} subtitle={r.subtitle} />
          ))}
        </View>
        {problem ? (
          <GuardrailNote tone="heads-up" testID="finish-problem">
            Annum couldn’t save your setup on this phone. Nothing was lost; try again.
          </GuardrailNote>
        ) : null}
        <View style={{ gap: space[8] }}>
          <Button
            variant="primary"
            label="Turn on reminders"
            disabled={busy}
            onPress={() => void finish(true)}
            testID="reminders-on"
          />
          <Button
            variant="quiet"
            label="Not now"
            disabled={busy}
            onPress={() => void finish(false)}
            testID="reminders-later"
          />
        </View>
      </ScreenScroll>
    </>
  );
}
