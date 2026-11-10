import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { app, colors, fonts, space, text } from '../../theme';

type Props = Omit<TextInputProps, 'style'> & { label: string; hint?: string; error?: string | null };

/** Multi-line input for notes and messages, styled to sit on the app's cards. */
export function TextArea({ label, hint, error, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <View style={styles.head}>
        <Text style={text.label}>{label}</Text>
        {hint ? <Text style={text.caption}>{hint}</Text> : null}
      </View>
      <TextInput
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.navy}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, !!error && styles.invalid, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  input: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: space.lg,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  focused: { backgroundColor: '#FFFFFF', borderColor: colors.navy },
  invalid: { borderColor: colors.danger },
  error: { ...text.caption, color: colors.danger, marginTop: 6 },
});
