import { Pressable, StyleSheet, View } from 'react-native';

import { color, layout, opacity, radius, size, space, symbols } from '@/theme';

import { Icon, type SymbolName } from './Icon';
import { Text } from './Text';

function Tile({ icon, tone = 'plain' }: { icon: SymbolName; tone?: 'plain' | 'add' }) {
  return (
    <View
      style={{
        width: size.sourceTile,
        height: size.sourceTile,
        borderRadius: radius.sm,
        backgroundColor: tone === 'add' ? color.tintOk : color.overlaySelected,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} tint={tone === 'add' ? color.statusOk : color.textPrimary} />
    </View>
  );
}

const card = {
  borderRadius: radius.lg,
  backgroundColor: color.bgSurface,
  overflow: 'hidden',
} as const;

const row = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space[12],
  minHeight: layout.sourceRow,
  paddingLeft: space[16],
} as const;

const content = {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: space[8],
  paddingRight: space[16],
  paddingVertical: space[12],
} as const;

const Chevron = () => <Icon name={symbols.forward} tint={color.textSecondary} />;

export interface SourceAccount {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  testID?: string;
}

/**
 * S3 Accounts: one card per place balances come from (a bank, files, by hand), its accounts
 * indented below (Figma 117:1729). `action` (Reconnect) makes the source row a button.
 */
export function AccountSourceCard({
  icon,
  title,
  subtitle,
  action,
  onPress,
  accounts,
  testID,
}: {
  icon: SymbolName;
  title: string;
  subtitle: string;
  action?: string;
  onPress?: () => void;
  accounts: SourceAccount[];
  testID?: string;
}) {
  const label = [title, action, subtitle].filter(Boolean).join(', ');
  return (
    <View style={card}>
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'header'}
        accessibilityLabel={label}
        style={({ pressed }) => [row, pressed && { opacity: opacity.pressed }]}
      >
        <Tile icon={icon} />
        <View style={content}>
          <View style={{ flex: 1, gap: space[2] }}>
            <Text variant="subhead">{title}</Text>
            <Text variant="footnote" tone="secondary">
              {subtitle}
            </Text>
          </View>
          {action ? <Text tone="secondary">{action}</Text> : null}
          {onPress ? <Chevron /> : null}
        </View>
      </Pressable>
      {accounts.map((a) => (
        <Pressable
          key={a.id}
          testID={a.testID}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={[a.title, a.value, a.subtitle].filter(Boolean).join(', ')}
          style={({ pressed }) => [
            row,
            { alignItems: 'stretch' },
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <View style={{ width: size.sourceTile }} />
          <View
            style={[
              content,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.borderSubtle },
            ]}
          >
            <View style={{ flex: 1, gap: space[2] }}>
              <Text>{a.title}</Text>
              {a.subtitle ? (
                <Text variant="footnote" tone="secondary">
                  {a.subtitle}
                </Text>
              ) : null}
            </View>
            {a.value ? (
              <Text variant="bodyMedium" money>
                {a.value}
              </Text>
            ) : null}
            <Chevron />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** S3 "Add an account" card (Figma 117:1769): opens S12. */
export function AddAccountCard({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <View style={card}>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add an account"
        style={({ pressed }) => [row, pressed && { opacity: opacity.pressed }]}
      >
        <Tile icon={symbols.add} tone="add" />
        <View style={content}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Add an account</Text>
          </View>
          <Chevron />
        </View>
      </Pressable>
    </View>
  );
}
