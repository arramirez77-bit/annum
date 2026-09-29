import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { color, layout, space } from '@/theme';

/** The standard scrolling screen: screen margins, keyboard-aware, under native headers. */
export function ScreenScroll({
  children,
  testID,
  surface = 'base',
  gap = space[20],
  fill = false,
}: {
  children: ReactNode;
  testID?: string;
  /** base: full screens · surface: sheets. */
  surface?: 'base' | 'surface';
  gap?: number;
  /** Content fills the screen, so a `flex: 1` spacer can push the buttons to the bottom. */
  fill?: boolean;
}) {
  return (
    <ScrollView
      style={{ backgroundColor: surface === 'base' ? color.bgBase : color.bgSurface }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: layout.screenMargin,
        gap,
        paddingBottom: space[40],
        ...(fill ? { flexGrow: 1 } : {}),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}
