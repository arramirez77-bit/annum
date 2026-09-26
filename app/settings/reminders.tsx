import { useState } from 'react';
import { View } from 'react-native';

import { askForReminders } from '@/services/notifications';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  Chip,
  GuardrailNote,
  ScreenScroll,
  SettingsGroup,
  SettingsRow,
  Text,
  TimeField,
} from '@/ui/components';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// S3 Notifications → Weekly review day and time. Scheduling itself arrives in M6.
export default function ReminderSettings() {
  const prefs = useAppStore((s) => s.prefs);
  const setPrefs = useAppStore((s) => s.setPrefs);
  const [note, setNote] = useState<string | null>(null);
  const weekly = prefs.reminders.weekly;
  const set = (next: typeof weekly) =>
    setPrefs({ reminders: { ...prefs.reminders, weekly: next } });

  return (
    <ScreenScroll testID="reminder-settings">
      {note ? <GuardrailNote tone="heads-up">{note}</GuardrailNote> : null}
      <SettingsGroup>
        <SettingsRow
          variant="toggle"
          label="Weekly review reminder"
          value={weekly !== null}
          onValueChange={async (on) => {
            if (on && !(await askForReminders())) {
              setNote('Reminders are off for Annum in iOS Settings → Notifications.');
              return;
            }
            set(on ? { weekday: 0, hour: 10, minute: 0 } : null);
          }}
          testID="weekly-toggle"
          last
        />
      </SettingsGroup>
      {weekly ? (
        <View style={{ gap: space[16] }}>
          <Text variant="subhead" tone="secondary">
            Day
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {DAYS.map((d, i) => (
              <Chip
                key={d}
                kind="category"
                label={d}
                selected={weekly.weekday === i}
                onPress={() => set({ ...weekly, weekday: i })}
                testID={`weekly-day-${i}`}
              />
            ))}
          </View>
          <TimeField
            label="Time"
            hour={weekly.hour}
            minute={weekly.minute}
            onChange={(hour, minute) => set({ ...weekly, hour, minute })}
          />
          <Text variant="footnote" tone="secondary">
            “Your weekly review is ready — about 10 minutes.”
          </Text>
        </View>
      ) : null}
    </ScreenScroll>
  );
}
