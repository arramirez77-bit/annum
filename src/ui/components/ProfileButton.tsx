import { Pressable } from 'react-native';

import { color, layout, opacity, radius, size, symbols } from '@/theme';

import { Icon } from './Icon';

/**
 * Profile Button (Figma 117:1581): the circle in every Today header that opens Settings.
 * 40pt visual circle on overlay/subtle with person.fill 18pt Medium; the tap area stays 44pt.
 */
export function ProfileButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const slop = (layout.touchTarget - size.profileButton) / 2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={slop}
      testID={testID}
      style={({ pressed }) => [
        {
          width: size.profileButton,
          height: size.profileButton,
          borderRadius: radius.full,
          backgroundColor: color.overlaySubtle,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <Icon name={symbols.profile} size="profile" weight="medium" />
    </Pressable>
  );
}
