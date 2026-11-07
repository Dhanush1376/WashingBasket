import React, { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputInstance, TextInputProps, View } from 'react-native';

import { colors, CONTROL_HEIGHT, radius, type } from '../../theme';
import { FIELD_BORDER, FloatingLabel } from './FloatingLabel';
import { InlineError } from './InlineError';

type Props = Omit<TextInputProps, 'style' | 'placeholder'> & {
  /** Floating label: rests inside the field, rises onto the border when focused or filled. */
  label: string;
  error?: string | null;
  /** Rendered at the right edge of the field (status icon, spinner). */
  trailing?: React.ReactNode;
  inputStyle?: TextInputProps['style'];
  /** Rounded corners, for forms inside the customer app's rounded cards. */
  rounded?: boolean;
};

const PAD_X = 16;

/** Outlined text field with a floating label, shared by the onboarding screens. */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, trailing, inputStyle, rounded, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const filled = !!rest.value;
  return (
    <View>
      <View style={[styles.field, rounded && styles.rounded, focused && styles.focused, !!error && styles.invalid, !editable && styles.readOnly]}>
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          selectionColor={colors.navy}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any), inputStyle]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        <FloatingLabel
          label={label}
          raised={focused || filled}
          focused={focused}
          error={!!error}
          restLeft={PAD_X - 4}
        />
      </View>
      {error ? <InlineError message={error} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    height: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.field,
    borderWidth: FIELD_BORDER,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ transition: 'border-color 0.2s ease' } as any) : {}),
  },
  focused: { borderColor: colors.navy },
  invalid: { borderColor: colors.danger },
  rounded: { borderRadius: 16 },
  readOnly: { opacity: 0.7 },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: PAD_X,
    ...type.input,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  trailing: { paddingRight: 16 },
});
