import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { color, size as sizes, symbols } from '@/theme';

export type SymbolName = (typeof symbols)[keyof typeof symbols];

interface IconProps {
  name: SymbolName;
  /** Match the text beside it: 'body' (17) or 'caption' (13); 'profile' (18) is the Profile Button glyph. */
  size?: 'body' | 'caption' | 'radio' | 'profile';
  tint?: ColorValue;
  /** Regular by default; Medium where the design asks (Profile Button). */
  weight?: 'regular' | 'medium';
}

const PX = {
  body: sizes.icon,
  caption: sizes.iconSmall,
  radio: sizes.radio,
  profile: sizes.profileGlyph,
} as const;

/** SF Symbols only, sized to the adjacent text, colored with text tokens. Decorative by default. */
export function Icon({
  name,
  size = 'body',
  tint = color.textPrimary,
  weight = 'regular',
}: IconProps) {
  const px = PX[size];
  return (
    <SymbolView
      name={name}
      size={px}
      tintColor={tint}
      weight={weight}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: px, height: px }}
    />
  );
}
