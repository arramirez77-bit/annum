import { Pressable, View } from 'react-native';

import { haptic } from '@/services/haptics';
import { color, layout, opacity, radius, size, space, symbols } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

interface ChipProps {
  /** category: pick one · tax: work-expense toggle (always last in a row). */
  kind: 'category' | 'tax';
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

const TOUCH_SLOP = (layout.touchTarget - layout.chipHeight) / 2;

/** 36pt visual, 44pt touch target. Tax: outlined in the Tax color; selected = filled + checkmark. */
export function Chip({ kind, label, selected, onPress, testID }: ChipProps) {
  const isTax = kind === 'tax';
  const fill = selected
    ? isTax
      ? color.bucket.tax
      : color.actionPrimary
    : isTax
      ? 'transparent'
      : color.bgRaised;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic('select');
        onPress();
      }}
      hitSlop={{ top: TOUCH_SLOP, bottom: TOUCH_SLOP }}
      accessibilityRole={isTax ? 'checkbox' : 'radio'}
      accessibilityLabel={isTax && !/work expense/i.test(label) ? `${label}, work expense` : label}
      accessibilityState={isTax ? { checked: selected } : { selected }}
      style={({ pressed }) => [
        {
          height: layout.chipHeight,
          borderRadius: radius.full,
          paddingHorizontal: space[16],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[4],
          backgroundColor: fill,
          borderWidth: isTax ? size.hairline : 0,
          borderColor: color.bucket.tax,
        },
        pressed && { opacity: opacity.pressed },
      ]}
    >
      {isTax && selected && (
        <View>
          <Icon name={symbols.check} size="caption" tint={color.textInverse} />
        </View>
      )}
      <Text variant="subhead" tone={selected ? 'inverse' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}
