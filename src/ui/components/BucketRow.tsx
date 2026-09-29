import { useId, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { formatDollars, type BucketKey, type Cents } from '@/domain';
import { color, fontScale, layout, money, opacity, radius, size, space, type } from '@/theme';

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
  /** card: Money screen · split: a flat row on the split sheet with the amount in a chip. */
  variant: 'card' | 'split';
  /** Split only: an editable chip with a statusOk outline (09b). Omit for Free, which absorbs changes. */
  onChangeAmount?: (cents: Cents) => void;
  /** Split only: tapping the plain chip (09, S14) starts changing the split. */
  onPressAmount?: () => void;
  /** Card only: the whole card opens something (Money's Invest card → S6). */
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}

// The chip is Headline + 4pt padding + a 1pt border; the tap area stays 44pt.
const CHIP_SLOP =
  (layout.touchTarget - (type.headline.lineHeight + space[4] * 2 + size.hairline * 2)) / 2;

export function BucketRow({
  bucket,
  name,
  note,
  amount,
  variant,
  onChangeAmount,
  onPressAmount,
  onPress,
  accessibilityHint,
  testID,
}: BucketRowProps) {
  const split = variant === 'split';
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const accessoryId = `split-done-${useId()}`;
  const slop = { top: CHIP_SLOP, bottom: CHIP_SLOP, left: CHIP_SLOP, right: CHIP_SLOP };
  // Bucket Row (Figma 54:587): a card on Money; flat 60pt rows on the split sheet (09, 09b, S14).
  const chip = (editable: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: space[12],
    paddingVertical: space[4],
    borderRadius: radius.md,
    borderWidth: size.hairline,
    borderColor: editable ? color.statusOk : color.bgRaised,
    backgroundColor: color.bgRaised,
  });
  const label = `${name}, ${formatDollars(amount)}. ${note}`;
  const rowStyle = split
    ? ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[12],
        paddingVertical: space[8],
      } as const)
    : ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[12],
        padding: space[16],
        borderRadius: radius.lg,
        backgroundColor: color.bgSurface,
      } as const);
  const Row = !split && onPress ? Pressable : View;
  return (
    <Row
      testID={testID}
      accessible={!onChangeAmount && !onPressAmount}
      accessibilityLabel={label}
      {...(!split && onPress
        ? { onPress, accessibilityRole: 'button' as const, accessibilityHint }
        : {})}
      style={
        !split && onPress
          ? ({ pressed }: { pressed: boolean }) => [
              rowStyle,
              pressed && { opacity: opacity.pressed },
            ]
          : rowStyle
      }
    >
      <BucketDot bucket={bucket} />
      <View style={{ flex: 1, gap: space[2] }}>
        <Text variant="bodyMedium">{name}</Text>
        <Text variant="footnote" tone="secondary">
          {note}
        </Text>
      </View>
      {split && onChangeAmount ? (
        <Pressable
          onPress={() => input.current?.focus()}
          hitSlop={slop}
          accessible={false}
          style={chip(true)}
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
      ) : split && onPressAmount ? (
        <Pressable
          onPress={onPressAmount}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Change the split"
          testID={testID ? `${testID}-amount` : undefined}
          style={({ pressed }) => [chip(false), pressed && { opacity: opacity.pressed }]}
        >
          <Text variant="headline" money>
            {formatDollars(amount)}
          </Text>
        </Pressable>
      ) : split ? (
        <View style={chip(false)}>
          <Text variant="headline" money>
            {formatDollars(amount)}
          </Text>
        </View>
      ) : (
        <Text variant="headline" money>
          {formatDollars(amount)}
        </Text>
      )}
    </Row>
  );
}
