import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { color, size as sizes, symbols } from '@/theme';

export type SymbolName = (typeof symbols)[keyof typeof symbols];

interface IconProps {
  name: SymbolName;
  /** Match the text beside it: 'body' (17) or 'caption' (13). */
  size?: 'body' | 'caption' | 'radio';
  tint?: ColorValue;
}

/** SF Symbols only, Regular weight, sized to the adjacent text, colored with text tokens. Decorative by default. */
export function Icon({ name, size = 'body', tint = color.textPrimary }: IconProps) {
  const px = size === 'caption' ? sizes.iconSmall : size === 'radio' ? sizes.radio : sizes.icon;
  return (
    <SymbolView
      name={name}
      size={px}
      tintColor={tint}
      weight="regular"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: px, height: px }}
    />
  );
}
