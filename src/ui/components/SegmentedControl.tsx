import { Pressable, View } from 'react-native';

import { haptic } from '@/services/haptics';
import { color, layout, radius, space } from '@/theme';

import { Text } from './Text';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}

/** Raised track with 44pt segments; the selected one is filled with the primary action color. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      // Figma 61:41: raised track (radius md, 4pt inset), segments radius sm, 12pt tall padding.
      style={{
        flexDirection: 'row',
        gap: space[4],
        padding: space[4],
        borderRadius: radius.md,
        backgroundColor: color.bgRaised,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            onPress={() => {
              if (!selected) {
                haptic('select');
                onChange(option.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: layout.touchTarget,
              paddingVertical: space[12],
              borderRadius: radius.sm,
              backgroundColor: selected ? color.actionPrimary : 'transparent',
            }}
          >
            <Text variant="subhead" tone={selected ? 'inverse' : 'primary'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
