import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';

import { localISODate, type ISODate } from '@/domain';
import { color, layout, space } from '@/theme';

import { Text } from './Text';

interface DateFieldProps {
  label: string;
  value: ISODate;
  onChange: (date: ISODate) => void;
  /** Earliest pickable day. */
  minimum?: ISODate;
  testID?: string;
}

/** Noon, so a local calendar date never slips a day across time zones or DST. */
const toDate = (d: ISODate) => new Date(`${d}T12:00:00`);

/** Label on the left, the native compact date button on the right (opens the iOS calendar). */
export function DateField({ label, value, onChange, minimum, testID }: DateFieldProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[12],
        minHeight: layout.touchTarget,
      }}
    >
      <Text variant="subhead" tone="secondary" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <DateTimePicker
        testID={testID}
        value={toDate(value)}
        mode="date"
        display="compact"
        themeVariant="dark"
        accentColor={color.textPrimary}
        minimumDate={minimum ? toDate(minimum) : undefined}
        accessibilityLabel={label}
        onValueChange={(_, date) => onChange(localISODate(date))}
      />
    </View>
  );
}

interface TimeFieldProps {
  label: string;
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

/** Label on the left, the native compact time button on the right. */
export function TimeField({ label, hour, minute, onChange }: TimeFieldProps) {
  const value = new Date(2026, 0, 4, hour, minute);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[12],
        minHeight: layout.touchTarget,
      }}
    >
      <Text variant="subhead" tone="secondary" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <DateTimePicker
        value={value}
        mode="time"
        display="compact"
        themeVariant="dark"
        accentColor={color.textPrimary}
        minuteInterval={5}
        accessibilityLabel={label}
        onValueChange={(_, date) => onChange(date.getHours(), date.getMinutes())}
      />
    </View>
  );
}
