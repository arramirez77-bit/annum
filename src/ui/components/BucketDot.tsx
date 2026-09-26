import { View } from 'react-native';

import { color, size } from '@/theme';
import type { BucketKey } from '@/domain';

interface BucketDotProps {
  /** 'none' is an invisible spacer so titles align in mixed lists. */
  bucket: BucketKey | 'none';
  muted?: boolean;
}

/** 12pt circle in the bucket's reserved color. Decorative: the bucket name is always beside it. */
export function BucketDot({ bucket, muted = false }: BucketDotProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size.bucketDot,
        height: size.bucketDot,
        borderRadius: size.bucketDot / 2,
        backgroundColor:
          bucket === 'none' ? 'transparent' : muted ? color.overlayMuted : color.bucket[bucket],
      }}
    />
  );
}
