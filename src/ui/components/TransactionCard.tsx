import { View } from 'react-native';

import { formatCents, type Cents } from '@/domain';
import { color, radius, space } from '@/theme';

import { Chip } from './Chip';
import { Text } from './Text';

interface TransactionCardProps {
  merchant: string;
  /** "Sep 21". */
  dateLabel: string;
  accountName: string;
  amount: Cents;
  /** Up to two category suggestions; the first is pre-selected by the caller. */
  suggestions: readonly string[];
  selectedCategory?: string;
  tax: boolean;
  onSelectCategory: (category: string) => void;
  onToggleTax: () => void;
  testID?: string;
}

/** Merchant, date · card, amount, then chips: 2 suggestions + Tax last. */
export function TransactionCard({
  merchant,
  dateLabel,
  accountName,
  amount,
  suggestions,
  selectedCategory,
  tax,
  onSelectCategory,
  onToggleTax,
  testID,
}: TransactionCardProps) {
  return (
    <View
      testID={testID}
      style={{
        gap: space[12],
        padding: space[16],
        borderRadius: radius.lg,
        backgroundColor: color.bgSurface,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${merchant}, ${formatCents(amount)}, ${dateLabel}, ${accountName}`}
        style={{ flexDirection: 'row', gap: space[12] }}
      >
        <View style={{ flex: 1, gap: space[2] }}>
          <Text variant="headline">{merchant}</Text>
          <Text variant="footnote" tone="secondary">
            {`${dateLabel} · ${accountName}`}
          </Text>
        </View>
        <Text variant="headline" money>
          {formatCents(amount)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
        {suggestions.slice(0, 2).map((category) => (
          <Chip
            key={category}
            kind="category"
            label={category}
            selected={selectedCategory === category}
            onPress={() => onSelectCategory(category)}
          />
        ))}
        <Chip kind="tax" label="Tax" selected={tax} onPress={onToggleTax} />
      </View>
    </View>
  );
}
