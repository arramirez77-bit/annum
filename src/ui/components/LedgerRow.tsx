import { Pressable, StyleSheet, View } from 'react-native';

import type { BucketKey } from '@/domain';
import { color, opacity, space, symbols } from '@/theme';

import { BucketDot } from './BucketDot';
import { Icon } from './Icon';
import { Text } from './Text';

interface LedgerRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  /** Light = the sheet on Today; dark = everywhere else. */
  surface: 'light' | 'dark';
  /** Bucket dot; use 'none' in mixed lists so titles align. */
  bucket?: BucketKey | 'none';
  onPress?: () => void;
  /** Tappable rows show a chevron unless the design leaves it out (S1 Transactions). */
  chevron?: boolean;
  /** Drop the hairline under the last row. */
  last?: boolean;
  testID?: string;
}

/** Title + subtitle on the left, value on the right, hairline below. */
export function LedgerRow({
  title,
  subtitle,
  value,
  surface,
  bucket,
  onPress,
  chevron = true,
  last = false,
  testID,
}: LedgerRowProps) {
  const light = surface === 'light';
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[12],
        paddingVertical: space[16],
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: light ? color.borderOnLight : color.borderSubtle,
      }}
    >
      {bucket && <BucketDot bucket={bucket} />}
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="bodyMedium" tone={light ? 'onLight' : 'primary'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone={light ? 'onLightSecondary' : 'secondary'}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="headline" money tone={light ? 'onLight' : 'primary'}>
          {value}
        </Text>
      ) : null}
      {onPress && chevron && (
        <Icon
          name={symbols.forward}
          tint={light ? color.textOnLightSecondary : color.textSecondary}
        />
      )}
    </View>
  );
  const label = [title, value, subtitle].filter(Boolean).join(', ');
  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && { opacity: opacity.pressed }}
    >
      {content}
    </Pressable>
  );
}
