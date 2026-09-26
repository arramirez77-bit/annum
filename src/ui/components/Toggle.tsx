import { Switch } from 'react-native';

import { color } from '@/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

/** Native iOS switch; on = status OK green. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
  testID,
}: ToggleProps) {
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: color.statusOk, false: color.bgRaised }}
      ios_backgroundColor={color.bgRaised}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
