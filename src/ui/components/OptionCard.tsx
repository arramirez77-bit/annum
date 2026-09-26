import { Pressable, View } from 'react-native';

import { color, opacity, radius, size, space, symbols } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

interface OptionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** Whole card is the target; radio on the right. */
export function OptionCard({ title, description, selected, onPress, testID }: OptionCardProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[12],
          padding: space[16],
          borderRadius: radius.lg,
          backgroundColor: color.bgSurface,
          borderWidth: size.hairline,
          borderColor: selected ? color.textPrimary : color.borderSubtle,
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={{ flex: 1, gap: space[4] }}>
        <Text variant="headline">{title}</Text>
        {description ? (
          <Text variant="callout" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Icon
        name={selected ? symbols.radioOn : symbols.radioOff}
        size="radio"
        tint={selected ? color.textPrimary : color.textSecondary}
      />
    </Pressable>
  );
}
