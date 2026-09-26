import { Stack } from 'expo-router';
import { View } from 'react-native';

import { color, layout, space } from '@/theme';
import { pushedHeader } from '@/ui/navigation';

import { Text } from './Text';

interface StubScreenProps {
  title: string;
  parentTitle: string;
  line: string;
}

/** A pushed screen that exists for navigation but is built in a later milestone. */
export function StubScreen({ title, parentTitle, line }: StubScreenProps) {
  return (
    <>
      <Stack.Screen options={pushedHeader(title, parentTitle)} />
      <View
        style={{
          flex: 1,
          backgroundColor: color.bgBase,
          padding: layout.screenMargin,
          gap: space[8],
        }}
      >
        <Text variant="title2" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="secondary">{line}</Text>
      </View>
    </>
  );
}
