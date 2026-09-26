import { View } from 'react-native';

import type { Cents } from '@/domain';
import { color, radius, size } from '@/theme';

interface SpendBarProps {
  /** Spent within the allowance (Free color). */
  within: Cents;
  /** Spent beyond the allowance (heads-up color — never red). */
  over: Cents;
  /** Allowance not yet spent (muted). */
  left: Cents;
  accessibilityLabel: string;
}

/** "Week reviewed" bar: spending against the week's allowance. */
export function SpendBar({ within, over, left, accessibilityLabel }: SpendBarProps) {
  const parts = [
    { key: 'within', amount: within, fill: color.bucket.free },
    { key: 'over', amount: over, fill: color.statusHeadsUp },
    { key: 'left', amount: left, fill: color.overlayMuted },
  ].filter((p) => p.amount > 0);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: size.bucketBarGap, height: size.bucketBar }}
    >
      {parts.map((p) => (
        <View
          key={p.key}
          style={{ flex: p.amount, borderRadius: radius.sm, backgroundColor: p.fill }}
        />
      ))}
    </View>
  );
}
