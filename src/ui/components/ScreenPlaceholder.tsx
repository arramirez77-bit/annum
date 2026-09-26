import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space, type } from '@/theme';

type Props = {
  title: string;
  line: string;
};

/** Temporary M0 screen body: a title and one line. Replaced by real screens in M3–M4. */
export function ScreenPlaceholder({ title, line }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.line}>{line}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgBase,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: space[24],
    gap: space[8],
  },
  title: {
    ...type.title1,
    color: color.textPrimary,
  },
  line: {
    ...type.body,
    color: color.textSecondary,
  },
});
