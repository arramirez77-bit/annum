import { View } from 'react-native';

import { color, radius, size, space, type } from '@/theme';

import { Text } from './Text';

interface GuardrailNoteProps {
  /** info: calm context · heads-up: a cause and one action. Never red, never "warning". */
  tone: 'info' | 'heads-up';
  surface?: 'dark' | 'light';
  children: string;
  testID?: string;
}

const FILL = {
  info: { dark: color.tintOk, light: color.tintOkOnLight },
  'heads-up': { dark: color.tintHeadsUp, light: color.tintHeadsUpOnLight },
} as const;

/** Tinted note with an 8pt dot. Dark text on light surfaces. */
export function GuardrailNote({ tone, surface = 'dark', children, testID }: GuardrailNoteProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={tone === 'heads-up' ? `Heads up. ${children}` : children}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[12],
        paddingVertical: space[12],
        paddingHorizontal: space[16],
        borderRadius: radius.md,
        backgroundColor: FILL[tone][surface],
      }}
    >
      <View
        style={{
          width: size.noteDot,
          height: size.noteDot,
          borderRadius: size.noteDot / 2,
          marginTop: (type.callout.lineHeight - size.noteDot) / 2,
          backgroundColor: tone === 'info' ? color.statusOk : color.statusHeadsUp,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text variant="callout" tone={surface === 'dark' ? 'primary' : 'onLight'}>
          {children}
        </Text>
      </View>
    </View>
  );
}
