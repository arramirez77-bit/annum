import { InputAccessoryView, Keyboard, Pressable, View } from 'react-native';

import { color, layout, opacity, space } from '@/theme';

import { Text } from './Text';

/**
 * A "Done" bar above the number pad (it has no Return key). One per input (accessories don't
 * cross into modals or sheets): attach with `inputAccessoryViewID={nativeID}`. iOS only shows
 * the focused input's bar; `active` gives that one the test id.
 */
export function KeyboardDoneBar({ nativeID, active }: { nativeID: string; active: boolean }) {
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: space[16],
          backgroundColor: color.bgRaised,
        }}
      >
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Done"
          testID={active ? 'keyboard-done' : undefined}
          style={({ pressed }) => [
            {
              minHeight: layout.touchTarget,
              minWidth: layout.touchTarget,
              justifyContent: 'center',
            },
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <Text variant="bodyMedium">Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
