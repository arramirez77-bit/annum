import { Pressable, StyleSheet, View } from 'react-native';

import { color, opacity, radius, size, space, symbols } from '@/theme';

import { Icon, type SymbolName } from './Icon';
import { Text } from './Text';

/** A choice on a light sheet: tile, title and one line, chevron (S12, Figma 117:1870). */
export function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
  first = false,
  testID,
}: {
  icon: SymbolName;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** No hairline above the first row. */
  first?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[14],
          paddingVertical: space[14],
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: color.borderOnLight,
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View
        style={{
          width: size.optionTile,
          height: size.optionTile,
          borderRadius: radius.tile,
          backgroundColor: color.overlaySelectedOnLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size="option" tint={color.textOnLight} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="bodyMedium" tone="onLight">
          {title}
        </Text>
        <Text variant="footnote" tone="onLightSecondary">
          {subtitle}
        </Text>
      </View>
      <Icon name={symbols.forward} tint={color.textOnLightSecondary} />
    </Pressable>
  );
}
