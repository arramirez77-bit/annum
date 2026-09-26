import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { color, layout, opacity, radius, space, symbols } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';
import { Toggle } from './Toggle';

/** Grouped container (surface, large radius) with an optional section title. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[8] }}>
      {title ? (
        <View style={{ paddingHorizontal: space[16] }}>
          <Text variant="footnote" tone="secondary" accessibilityRole="header">
            {title}
          </Text>
        </View>
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
    gap: space[12],
    minHeight: layout.touchTarget,
    paddingVertical: space[8],
    paddingHorizontal: space[16],
  };
  const separator = !last && (
    <View
      style={{
        marginLeft: space[16],
        height: StyleSheet.hairlineWidth,
        backgroundColor: color.borderSubtle,
      }}
    />
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
  const trailing = props.variant === 'value' ? <Text tone="secondary">{props.value}</Text> : null;
  return (
    <View testID={testID}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={props.variant === 'value' ? `${label}, ${props.value}` : label}
        style={({ pressed }) => [rowStyle, pressed && { opacity: opacity.pressed }]}
      >
        <View style={{ flex: 1 }}>
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
