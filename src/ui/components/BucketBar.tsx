import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { BucketKey, Cents } from '@/domain';
import { color, motion, radius, size } from '@/theme';

export interface BarSegment {
  bucket: BucketKey;
  amount: Cents;
}

interface BucketBarProps {
  segments: readonly BarSegment[];
  /** Not split yet (E3): every segment in the muted color. */
  muted?: boolean;
  /** Spoken summary, e.g. "Savings: Tax $3,000, Bills $2,000…". */
  accessibilityLabel: string;
}

const easing = Easing.bezier(...motion.easeOutExpo);

function Segment({ width, fill }: { width: number; fill: string }) {
  const reduceMotion = useReducedMotion();
  const animated = useSharedValue(width);
  useEffect(() => {
    animated.value = withTiming(width, { duration: reduceMotion ? 0 : motion.resize, easing });
  }, [width, reduceMotion, animated]);
  const style = useAnimatedStyle(() => ({ width: animated.value }));
  return (
    <Animated.View
      style={[{ height: size.bucketBar, borderRadius: radius.sm, backgroundColor: fill }, style]}
    />
  );
}

/** 16pt proportional bar, 3pt gaps, zero buckets hidden; widths animate (250ms, off with Reduce Motion). */
export function BucketBar({ segments, muted = false, accessibilityLabel }: BucketBarProps) {
  const [width, setWidth] = useState(0);
  const visible = segments.filter((s) => s.amount > 0);
  const total = visible.reduce((a, s) => a + s.amount, 0);
  const available = Math.max(width - size.bucketBarGap * Math.max(visible.length - 1, 0), 0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: size.bucketBarGap, height: size.bucketBar }}
    >
      {width > 0 && total === 0 && (
        <View
          style={{
            flex: 1,
            height: size.bucketBar,
            borderRadius: radius.sm,
            backgroundColor: color.overlayMuted,
          }}
        />
      )}
      {width > 0 &&
        visible.map((s) => (
          <Segment
            key={s.bucket}
            width={total > 0 ? (available * s.amount) / total : 0}
            fill={muted ? color.overlayMuted : color.bucket[s.bucket]}
          />
        ))}
    </View>
  );
}
