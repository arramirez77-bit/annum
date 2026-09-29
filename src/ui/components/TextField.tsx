import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { color, fontScale, radius, size, space, type } from '@/theme';

import { Text } from './Text';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helper?: string;
  placeholder?: string;
  /** Passphrases: hidden characters, no autocorrect, no autofill suggestions. */
  secure?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoFocus?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  /** Title 2 text in a 16pt-padded field, like AmountInput (S8's DELETE, Figma 71:1095). */
  large?: boolean;
  testID?: string;
}

/** Label above, Body text in a raised field (same shape as AmountInput). */
export function TextField({
  label,
  value,
  onChangeText,
  helper,
  placeholder,
  secure = false,
  autoCapitalize = 'sentences',
  autoFocus,
  returnKeyType = 'done',
  onSubmitEditing,
  large = false,
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={color.textSecondary}
        selectionColor={color.textPrimary}
        secureTextEntry={secure}
        autoCorrect={!secure}
        autoCapitalize={secure ? 'none' : autoCapitalize}
        textContentType={secure ? 'oneTimeCode' : 'none'}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        keyboardAppearance="dark"
        allowFontScaling
        maxFontSizeMultiplier={fontScale.default}
        accessibilityLabel={label}
        accessibilityHint={helper}
        style={[
          large ? type.title2 : type.body,
          {
            color: color.textPrimary,
            minHeight: size.fieldHeight,
            paddingHorizontal: space[16],
            paddingVertical: large ? space[16] : space[12],
            borderRadius: radius.md,
            backgroundColor: color.bgRaised,
            borderWidth: size.hairline,
            borderColor: focused ? color.textPrimary : color.bgRaised,
          },
        ]}
      />
      {helper ? (
        <Text variant="footnote" tone="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
