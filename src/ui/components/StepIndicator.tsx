import { View } from 'react-native';

import { color, radius, size, space } from '@/theme';

interface StepIndicatorProps {
  /** 1-based current step. */
  step: number;
  total: number;
}

/** 22 × 4 segments: done and current filled, the rest muted. Reads "Step N of M". */
export function StepIndicator({ step, total }: StepIndicatorProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      style={{ flexDirection: 'row', gap: space[4] }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: size.stepWidth,
            height: size.stepHeight,
            borderRadius: radius.full,
            backgroundColor: i < step ? color.textPrimary : color.overlayMuted,
          }}
        />
      ))}
    </View>
  );
}
