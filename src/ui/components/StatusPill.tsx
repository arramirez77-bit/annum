import { Pressable, View } from 'react-native';

import type { TodayStatus } from '@/domain';
import { color, layout, radius, size, space } from '@/theme';

import { Text } from './Text';

const LABEL: Record<TodayStatus, string> = {
  'on-track': 'On track',
  'heads-up': 'Heads up',
  estimate: 'Estimate',
};

const DOT: Record<TodayStatus, string> = {
  'on-track': color.statusOk,
  'heads-up': color.statusHeadsUp,
  estimate: color.textSecondary,
};

interface StatusPillProps {
  status: TodayStatus;
  /** Demo mode: long-press opens the scenario switcher. */
  onLongPress?: () => void;
  testID?: string;
}

/** Subtle overlay pill with a 7pt dot and a Caption label. */
export function StatusPill({ status, onLongPress, testID }: StatusPillProps) {
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[8],
        paddingHorizontal: space[12],
        paddingVertical: space[4],
        borderRadius: radius.full,
        backgroundColor: color.overlaySubtle,
      }}
    >
      <View
        style={{
          width: size.pillDot,
          height: size.pillDot,
          borderRadius: size.pillDot / 2,
          backgroundColor: DOT[status],
        }}
      />
      <Text variant="caption">{LABEL[status]}</Text>
    </View>
  );
  if (!onLongPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={`Status: ${LABEL[status]}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onLongPress={onLongPress}
      hitSlop={{ top: space[12], bottom: space[12], left: space[4], right: space[4] }}
      style={{ minHeight: layout.touchTarget - space[16], justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${LABEL[status]}`}
      accessibilityHint="Long press to switch the demo scenario"
    >
      {body}
    </Pressable>
  );
}
