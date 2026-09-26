import { Pressable, View } from 'react-native';

import { color, layout, opacity, radius, space } from '@/theme';

import { Text, type TextTone } from './Text';

export type ButtonVariant = 'primary' | 'field' | 'caution' | 'secondary' | 'destructive' | 'quiet';

interface ButtonProps {
  variant: ButtonVariant;
  /** Outcome, not action: "Confirm split", "Looks right · Next". */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Secondary and quiet buttons adapt to the light sheet on Today. */
  surface?: 'dark' | 'light';
  accessibilityHint?: string;
  testID?: string;
}

const fills: Record<ButtonVariant, { dark: string; light: string }> = {
  primary: { dark: color.actionPrimary, light: color.actionPrimary },
  field: { dark: color.actionField, light: color.actionField },
  caution: { dark: color.actionCaution, light: color.actionCaution },
  secondary: { dark: color.bgRaised, light: color.overlaySelectedOnLight },
  destructive: { dark: color.statusDestructive, light: color.statusDestructive },
  quiet: { dark: 'transparent', light: 'transparent' },
};

const tones: Record<ButtonVariant, { dark: TextTone; light: TextTone }> = {
  primary: { dark: 'inverse', light: 'inverse' },
  field: { dark: 'primary', light: 'primary' },
  caution: { dark: 'primary', light: 'primary' },
  secondary: { dark: 'primary', light: 'onLight' },
  destructive: { dark: 'inverse', light: 'inverse' },
  quiet: { dark: 'secondary', light: 'onLightSecondary' },
};

/** 50pt, full width, pill-shaped, Body Medium. One primary action per screen. Pressed = 0.8 opacity. */
export function Button({
  variant,
  label,
  onPress,
  disabled = false,
  surface = 'dark',
  accessibilityHint,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          alignSelf: 'stretch',
          minHeight: layout.buttonHeight,
          borderRadius: radius.full,
          backgroundColor: fills[variant][surface],
          justifyContent: 'center',
          paddingHorizontal: space[24],
        },
        pressed && { opacity: opacity.pressed },
        disabled && { opacity: opacity.disabled },
      ]}
    >
      <View>
        <Text variant="bodyMedium" tone={tones[variant][surface]} align="center">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
