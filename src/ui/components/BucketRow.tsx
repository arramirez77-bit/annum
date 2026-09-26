import { useId, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { formatDollars, type BucketKey, type Cents } from '@/domain';
import { color, fontScale, layout, money, radius, space, type } from '@/theme';

import { formatDollarDigits, parseDollarsToCents } from './AmountInput';
import { BucketDot } from './BucketDot';
import { KeyboardDoneBar } from './KeyboardDoneBar';
import { Text } from './Text';

interface BucketRowProps {
  bucket: BucketKey;
  name: string;
  /** One-line note: "Due before Oct 13", "4.2 months · $15k target". */
  note: string;
  amount: Cents;
  /** card: Money screen · split: deposit split with an editable amount chip. */
  variant: 'card' | 'split';
  /** Split only. Omit for Free, which absorbs changes. */
  onChangeAmount?: (cents: Cents) => void;
  testID?: string;
}

export function BucketRow({
  bucket,
  name,
  note,
  amount,
  variant,
  onChangeAmount,
  testID,
}: BucketRowProps) {
  const split = variant === 'split';
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const accessoryId = `split-done-${useId()}`;
  // The chip is 36pt; this keeps the tap target at 44pt and focuses the field.
  const slop = (layout.touchTarget - layout.chipHeight) / 2;
  return (
    <View
      testID={testID}
      accessible={!onChangeAmount}
      accessibilityLabel={`${name}, ${formatDollars(amount)}. ${note}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[12],
        padding: space[16],
        borderRadius: radius.lg,
        backgroundColor: color.bgSurface,
      }}
    >
      <BucketDot bucket={bucket} />
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="headline">{name}</Text>
        <Text variant="footnote" tone="secondary">
          {note}
        </Text>
      </View>
      {split && onChangeAmount ? (
        <Pressable
          onPress={() => input.current?.focus()}
          hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
          accessible={false}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: layout.chipHeight,
            paddingHorizontal: space[12],
            borderRadius: radius.full,
            backgroundColor: color.bgRaised,
          }}
        >
          <Text variant="headline" money>
            $
          </Text>
          <TextInput
            ref={input}
            testID={testID ? `${testID}-amount` : undefined}
            value={formatDollarDigits(amount)}
            onChangeText={(text) => onChangeAmount(parseDollarsToCents(text) ?? 0)}
            keyboardType="number-pad"
            inputAccessoryViewID={accessoryId}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={color.textPrimary}
            allowFontScaling
            maxFontSizeMultiplier={fontScale.default}
            accessibilityLabel={`${name} amount`}
            accessibilityHint="Free absorbs the difference, so the total stays the same"
            style={[
              type.headline,
              { color: color.textPrimary, fontVariant: [...money.fontVariant] },
            ]}
          />
          <KeyboardDoneBar nativeID={accessoryId} active={focused} />
        </Pressable>
      ) : (
        <Text variant="headline" money>
          {formatDollars(amount)}
        </Text>
      )}
    </View>
  );
}
