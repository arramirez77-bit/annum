import { View } from 'react-native';

import type { BucketKey } from '@/domain';
import { color, radius, space } from '@/theme';

import { BucketDot } from './BucketDot';
import { Text } from './Text';

interface DeltaCardProps {
  bucket: BucketKey;
  title: string;
  value: string;
  line: string;
  testID?: string;
}

/** 06 What changed: bucket dot + title, a big value, and a one-line change. */
export function DeltaCard({ bucket, title, value, line, testID }: DeltaCardProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${title}, ${value}. ${line}`}
      style={{
        gap: space[8],
        padding: space[16],
        borderRadius: radius.lg,
        backgroundColor: color.bgSurface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <BucketDot bucket={bucket} />
        <Text variant="subhead" tone="secondary">
          {title}
        </Text>
      </View>
      <Text variant="title1" money>
        {value}
      </Text>
      <Text variant="callout" tone="secondary">
        {line}
      </Text>
    </View>
  );
}
