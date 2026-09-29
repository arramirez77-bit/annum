import { View } from 'react-native';

import { space } from '@/theme';
import { ScreenScroll, Text } from '@/ui/components';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'It stays on this phone',
    body: 'Your balances, transactions and settings live in one file on this iPhone. There’s no Annum account and no Annum server holding your money data.',
  },
  {
    title: 'It’s encrypted',
    body: 'That file is encrypted with a key made on this phone and kept in the iPhone Keychain. Face ID (or your passcode) opens Annum.',
  },
  {
    title: 'Moving to a new phone',
    body: 'The key never leaves this phone, so an iCloud backup alone can’t open your data on another one. Use Settings → Export all data to make a backup file with a passphrase, then Restore from a backup on the new phone.',
  },
  {
    title: 'No tracking',
    body: 'Annum has no ads, no analytics, and never sends your numbers anywhere. Delete everything in Settings removes it all from this phone.',
  },
];

// "How your data stays private" (from O1). docs/02 "Storage & security", in plain words.
export default function Privacy() {
  return (
    <ScreenScroll testID="privacy">
      <Text variant="title1" accessibilityRole="header">
        How your data stays private
      </Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: space[4] }}>
          <Text variant="headline" accessibilityRole="header">
            {s.title}
          </Text>
          <Text tone="secondary">{s.body}</Text>
        </View>
      ))}
    </ScreenScroll>
  );
}
