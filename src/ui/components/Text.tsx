import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { color, fontScale, money as moneyStyle, type as typeScale } from '@/theme';

export type TextVariant = keyof typeof typeScale;
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'onLight'
  | 'onLightSecondary'
  | 'onCautionSecondary'
  | 'inverse'
  | 'destructive';

const toneColor: Record<TextTone, string> = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  onLight: color.textOnLight,
  onLightSecondary: color.textOnLightSecondary,
  onCautionSecondary: color.textOnCautionSecondary,
  inverse: color.textInverse,
  destructive: color.statusDestructive,
};

const LARGE: TextVariant[] = ['hero', 'display'];

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Tabular numbers for money. */
  money?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * All app text. System font (SF Pro) with Dynamic Type: scales with the user's setting,
 * capped at 1.3× for Hero/Display and 2× for everything else so layouts hold.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  money = false,
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={LARGE.includes(variant) ? fontScale.large : fontScale.default}
      style={[
        typeScale[variant],
        { color: toneColor[tone] },
        money && { fontVariant: [...moneyStyle.fontVariant] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
