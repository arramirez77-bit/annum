import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, layout, opacity, size, space, symbols } from '@/theme';
import { Button, Icon, Mark, Text, Wordmark } from '@/ui/components';
import { DevEntry } from '@/ui/flows/DevEntry';

// O1 Welcome (Figma 62:422): the lockup centered, then Get started, Restore from a backup, and
// the privacy link. docs/05.
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bgBase,
        alignItems: 'center',
        gap: space[12],
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: layout.screenMargin,
      }}
      testID="welcome"
    >
      <View style={{ flex: 1 }} />
      <View style={{ alignItems: 'center', gap: space[24], alignSelf: 'stretch' }}>
        <DevEntry>
          <Mark size={size.markWelcome} />
        </DevEntry>
        <View style={{ alignItems: 'center', gap: space[8] }}>
          <Wordmark size="display" />
          <Text variant="sentence" tone="secondary" align="center">
            Money, by the year.
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ alignSelf: 'stretch', gap: space[12] }}>
        <Button
          variant="primary"
          label="Get started"
          onPress={() => router.push('/income')}
          testID="welcome-start"
        />
        <Button
          variant="quiet"
          label="Restore from a backup"
          onPress={() => router.push('/restore')}
          testID="welcome-restore"
        />
      </View>
      <Pressable
        onPress={() => router.push('/privacy')}
        accessibilityRole="link"
        accessibilityLabel="How your data stays private"
        testID="welcome-privacy"
        style={({ pressed }) => [
          {
            minHeight: layout.touchTarget,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[4],
            alignSelf: 'stretch',
          },
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Icon name={symbols.lock} size="caption" tint={color.textSecondary} />
        <Text variant="footnote" tone="secondary">
          How your data stays private
        </Text>
      </Pressable>
    </View>
  );
}
