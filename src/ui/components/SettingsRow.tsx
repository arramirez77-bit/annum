import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, layout, opacity, radius, space, symbols } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';
import { Toggle } from './Toggle';

/** Grouped container (surface, large radius) with an optional section title (Figma S3 64:765). */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: layout.titleGap }}>
      {title ? (
        <Text variant="footnote" tone="secondary" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View
        style={{ borderRadius: radius.lg, backgroundColor: color.bgSurface, overflow: 'hidden' }}
      >
        {children}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  label: string;
  last?: boolean;
  testID?: string;
} & (
  | { variant: 'toggle'; value: boolean; onValueChange: (value: boolean) => void }
  | { variant: 'value'; value: string; onPress?: () => void }
  | { variant: 'chevron'; onPress: () => void }
  | { variant: 'destructive'; onPress: () => void }
);

export function SettingsRow(props: SettingsRowProps) {
  const { label, last = false, testID } = props;
  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space[8],
    minHeight: layout.touchTarget,
    paddingVertical: space[12],
    paddingHorizontal: space[16],
  };
  const separator = !last && (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.borderSubtle }} />
  );

  if (props.variant === 'toggle') {
    return (
      <View testID={testID}>
        <View style={rowStyle}>
          <View style={{ flex: 1 }}>
            <Text>{label}</Text>
          </View>
          <Toggle
            value={props.value}
            onValueChange={props.onValueChange}
            accessibilityLabel={label}
            testID={testID ? `${testID}-switch` : undefined}
          />
        </View>
        {separator}
      </View>
    );
  }

  const onPress = props.onPress;
  const value = props.variant === 'value' ? props.value : undefined;
  // Label and value share the row, so at large text sizes both wrap instead of a word breaking.
  const trailing = value ? (
    <Text tone="secondary" align="right" style={{ flexShrink: 1 }}>
      {value}
    </Text>
  ) : null;
  return (
    <View testID={testID}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={value ? `${label}, ${value}` : label}
        style={({ pressed }) => [rowStyle, pressed && { opacity: opacity.pressed }]}
      >
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Text tone={props.variant === 'destructive' ? 'destructive' : 'primary'}>{label}</Text>
        </View>
        {trailing}
        {onPress && props.variant !== 'destructive' && (
          <Icon name={symbols.forward} tint={color.textSecondary} />
        )}
      </Pressable>
      {separator}
    </View>
  );
}
