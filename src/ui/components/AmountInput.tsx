import { useState } from 'react';
import { TextInput, View } from 'react-native';

import type { Cents } from '@/domain';
import { color, fontScale, money, radius, size, space, type } from '@/theme';

import { Text } from './Text';

const MAX_DIGITS = 9; // up to $999,999,999
const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Whole dollars typed on the number pad → cents (null when empty). */
export function parseDollarsToCents(text: string): Cents | null {
  const digits = text.replace(/\D/g, '').slice(0, MAX_DIGITS);
  return digits ? Number(digits) * 100 : null;
}

export const formatDollarDigits = (cents: Cents | null): string =>
  cents === null ? '' : grouped.format(Math.floor(cents / 100));

interface AmountInputProps {
  label: string;
  valueCents: Cents | null;
  onChangeCents: (cents: Cents | null) => void;
  /** Live consequence sentence under the field. */
  helper?: string;
  autoFocus?: boolean;
  testID?: string;
}

/** Label above, "$" + Title 2 value, number pad, thousands separators, live helper sentence. */
export function AmountInput({
  label,
  valueCents,
  onChangeCents,
  helper,
  autoFocus,
  testID,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const filled = valueCents !== null;
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[4],
          paddingHorizontal: space[16],
          paddingVertical: space[12],
          borderRadius: radius.md,
          backgroundColor: color.bgRaised,
          borderWidth: size.hairline,
          borderColor: focused ? color.textPrimary : color.bgRaised,
        }}
      >
        <Text variant="title2" money tone={filled ? 'primary' : 'secondary'}>
          $
        </Text>
        <TextInput
          testID={testID}
          value={formatDollarDigits(valueCents)}
          onChangeText={(text) => onChangeCents(parseDollarsToCents(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={color.textSecondary}
          selectionColor={color.textPrimary}
          allowFontScaling
          maxFontSizeMultiplier={fontScale.default}
          accessibilityLabel={label}
          accessibilityHint={helper}
          style={[
            type.title2,
            { flex: 1, color: color.textPrimary, fontVariant: [...money.fontVariant] },
          ]}
        />
      </View>
      {helper ? (
        <Text variant="callout" tone="secondary" accessibilityLiveRegion="polite">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
