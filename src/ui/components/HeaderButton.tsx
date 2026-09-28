import { Pressable } from 'react-native';

import { layout, opacity } from '@/theme';

import { Text } from './Text';

/**
 * Text button for native headers: Cancel, Skip, Back, Close, Finish later (docs/01 top-bar
 * patterns). At least 44×44pt, with the label centered, so it sits centered in the top bar.
 */
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
      testID={testID}
      style={({ pressed }) => [
        {
          minWidth: layout.touchTarget,
          minHeight: layout.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}
