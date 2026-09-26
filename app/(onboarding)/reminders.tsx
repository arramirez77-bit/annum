import { useState } from 'react';
import { View } from 'react-native';

import { askForReminders } from '@/services/notifications';
import { useOnboarding } from '@/state/onboarding';
import { finishOnboarding } from '@/state/session';
import { space } from '@/theme';
import { Button, GuardrailNote, LedgerRow, ScreenScroll, Text } from '@/ui/components';

// O4c Want a nudge on Sundays? → Today in estimate state. docs/05, docs/02 "Notifications".
export default function Reminders() {
  const incomeType = useOnboarding((s) => s.incomeType);
  const setReminders = useOnboarding((s) => s.setReminders);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const rows = [
    { title: 'Weekly review', subtitle: 'Sundays at 10 AM · about 10 minutes' },
    { title: 'Card statements', subtitle: '2 days before each one is due' },
    ...(incomeType === 'salary'
      ? []
      : [{ title: 'Quarterly taxes', subtitle: 'A week before each IRS date' }]),
    {
      title: incomeType === 'salary' ? 'Paydays' : 'Deposits and late invoices',
      subtitle: 'When money lands, or when it’s late',
    },
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
    <ScreenScroll testID="onboarding-reminders">
      <View style={{ gap: space[4] }}>
        <Text variant="title2" accessibilityRole="header">
          Want a nudge on Sundays?
        </Text>
        <Text tone="secondary">
          Reminders stay on this phone. Change them any time in Settings.
        </Text>
      </View>
      <View>
        {rows.map((r, i) => (
          <LedgerRow
            key={r.title}
            surface="dark"
            title={r.title}
            subtitle={r.subtitle}
            last={i === rows.length - 1}
          />
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
  );
}
