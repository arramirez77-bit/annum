import { Pressable, View } from 'react-native';

import { color, layout, opacity, radius, size, symbols } from '@/theme';

import { Icon } from './Icon';

/** Sheet Close: a 32pt circle in a 44pt tap area (S12, Figma 117:1954). */
export function CloseButton({
  onPress,
  surface = 'light',
  testID,
}: {
  onPress: () => void;
  surface?: 'light' | 'dark';
  testID?: string;
}) {
  const light = surface === 'light';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={({ pressed }) => [
        {
          width: layout.touchTarget,
          height: layout.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View
        style={{
          width: size.closeButton,
          height: size.closeButton,
          borderRadius: radius.full,
          backgroundColor: light ? color.overlaySelectedOnLight : color.overlaySelected,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={symbols.close}
          size="close"
          weight="medium"
          tint={light ? color.textOnLightSecondary : color.textSecondary}
        />
      </View>
    </Pressable>
  );
}
