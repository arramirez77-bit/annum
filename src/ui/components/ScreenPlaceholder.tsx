import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '@/theme';

import { Text } from './Text';

type Props = {
  title: string;
  line: string;
  children?: ReactNode;
};

/** Temporary screen body: a title and one line. Replaced by real screens in M3–M4. */
export function ScreenPlaceholder({ title, line, children }: Props) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bgBase }}
      edges={['top', 'left', 'right']}
    >
      <View
        style={{ paddingHorizontal: layout.screenMargin, paddingTop: space[24], gap: space[8] }}
      >
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="secondary">{line}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}
