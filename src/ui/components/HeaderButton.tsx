import { Pressable } from 'react-native';

import { opacity, space } from '@/theme';

import { Text } from './Text';

/** Text button for native headers: Cancel, Skip, Back, Finish later (docs/01 top-bar patterns). */
export function HeaderButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space[8]}
      testID={testID}
      style={({ pressed }) => pressed && { opacity: opacity.pressed }}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}
