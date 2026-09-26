import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BucketKey } from '@/domain';
import { color, layout, size, space } from '@/theme';
import { BucketDot, Button, Mark, Text, Wordmark } from '@/ui/components';
import { DevEntry } from '@/ui/flows/DevEntry';

const PROMISES: { bucket: BucketKey; line: string }[] = [
  { bucket: 'free', line: 'One number: what you can spend today, in a sentence.' },
  { bucket: 'runway', line: 'Your cushion, measured in months.' },
  { bucket: 'tax', line: 'Money for taxes set aside as it lands.' },
];

// O1 Welcome. docs/05.
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bgBase,
        paddingTop: insets.top + space[48],
        paddingBottom: insets.bottom + space[16],
        paddingHorizontal: layout.screenMargin,
        justifyContent: 'space-between',
      }}
      testID="welcome"
    >
      <View style={{ gap: space[32] }}>
        <View style={{ gap: space[16] }}>
          <DevEntry>
            <Mark size={size.markLockup} />
          </DevEntry>
          <Wordmark />
          <Text variant="sentence">Money, by the year.</Text>
        </View>
        <View style={{ gap: space[16] }}>
          {PROMISES.map((p) => (
            <View
              key={p.bucket}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}
            >
              <BucketDot bucket={p.bucket} />
              <Text style={{ flex: 1 }}>{p.line}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label="Get started"
          onPress={() => router.push('/income')}
          testID="welcome-start"
        />
        <Button
          variant="quiet"
          label="How your data stays private"
          onPress={() => router.push('/privacy')}
          testID="welcome-privacy"
        />
        <Button
          variant="quiet"
          label="Restore from a backup"
          onPress={() => router.push('/restore')}
          testID="welcome-restore"
        />
        <Text variant="footnote" tone="secondary" align="center">
          About 3 minutes. Every step can be skipped.
        </Text>
      </View>
    </View>
  );
}
