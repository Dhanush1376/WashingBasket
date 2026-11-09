import React, { forwardRef, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '../app/Icon';
import { Rise } from '../app/motion';
import { colors, fonts, space, text } from '../../theme';
import './SheetForm.css'; // keeps autofilled fields in our own colours on the web

/**
 * The parts every drawer form is built from (the wallet's Top Up, the profile drawers, sign-in):
 * soft pill fields that turn white with a dark edge when focused, soft chips, a summary box.
 */
export const FORM = { field: '#F4F2EB', edge: '#C4BEAD', chip: '#EFECE6' } as const;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none', outline: 'none', backgroundColor: 'transparent' } as object) : null;

type PillFieldProps = Omit<TextInputProps, 'style'> & {
  /** Sits at the end, after a hairline, saying what the field is for. */
  icon?: IconName;
  /** Replaces the icon, e.g. a spinner or a tick. */
  trailing?: React.ReactNode;
  /** Sits at the start, before a hairline, e.g. a country code. */
  leading?: React.ReactNode;
  invalid?: boolean;
  /** Working on it: the field keeps focus and the keyboard but ignores typing. */
  busy?: boolean;
  /** Shown but fixed: muted and not editable, e.g. the sign-in number. */
  locked?: boolean;
  inputStyle?: TextInputProps['style'];
};

/** Controlled fields snap back to their value, so ignoring a change discards the keystroke. */
const ignoreTyping = () => {};

export const PillField = forwardRef<TextInputInstance, PillFieldProps>(function PillField(
  { icon, trailing, leading, invalid, locked, busy, inputStyle, onFocus, onBlur, placeholder, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[formStyles.field, locked && formStyles.fieldLocked, focused && formStyles.fieldFocus, invalid && formStyles.fieldError]}>
      {leading ? (
        <>
          {leading}
          <View style={formStyles.divider} />
        </>
      ) : null}
      <TextInput
        ref={ref}
        {...input}
        placeholder={placeholder}
        // Next / Done never blur the field: blurring puts the keyboard away just before the
        // next field or step would take it
        submitBehavior={input.submitBehavior ?? 'submit'}
        editable={locked ? false : input.editable}
        // busy: keep focus (and the keyboard) but ignore typing until the request finishes;
        // editable={false} would make iOS put the keyboard away
        onChangeText={busy ? ignoreTyping : input.onChangeText}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={input.accessibilityLabel ?? placeholder}
        selectionColor={colors.navy}
        style={[formStyles.input, noOutline, locked && formStyles.inputLocked, inputStyle]}
      />
      {trailing ?? (icon ? (
        <>
          <View style={formStyles.divider} />
          <View style={[formStyles.iconBadge, locked && formStyles.iconBadgeLocked]}>
            <Icon name={icon} size={13} color="#FFFFFF" strokeWidth={2.3} />
          </View>
        </>
      ) : null)}
    </View>
  );
});

type PillTextAreaProps = Omit<TextInputProps, 'style'> & {
  invalid?: boolean;
  inputStyle?: TextInputProps['style'];
};

export const PillTextArea = forwardRef<TextInputInstance, PillTextAreaProps>(function PillTextArea(
  { invalid, inputStyle, onFocus, onBlur, placeholder, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[formStyles.textAreaField, focused && formStyles.fieldFocus, invalid && formStyles.fieldError]}>
      <TextInput
        ref={ref}
        {...input}
        multiline
        placeholder={placeholder}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel={input.accessibilityLabel ?? placeholder}
        selectionColor={colors.navy}
        textAlignVertical="top"
        style={[formStyles.textAreaInput, noOutline, inputStyle]}
      />
    </View>
  );
});

/** A soft chip that eases to white with a dark edge when chosen. No bounce: just the colour change. */
export function OptionChip({
  label,
  icon,
  selected,
  delay = 0,
  style,
  onPress,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const sel = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    sel.set(withTiming(selected ? 1 : 0, { duration: 240 }));
  }, [sel, selected]);
  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [FORM.chip, '#FFFFFF']),
    borderColor: interpolateColor(sel.value, [0, 1], [FORM.edge, colors.ink]),
  }));
  return (
    <Rise delay={delay} style={[{ flex: 1 }, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        style={webCursor}
      >
        <Animated.View style={[formStyles.chip, anim]}>
          {selected ? (
            <View style={formStyles.chipDot}>
              <Icon name={icon} size={11} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          ) : (
            <Icon name={icon} size={15} color={colors.inkSoft} />
          )}
          <Text style={[formStyles.chipText, selected && formStyles.chipTextOn]}>{label}</Text>
        </Animated.View>
      </Pressable>
    </Rise>
  );
}

/** Six rounded boxes over one hidden input: the box being typed into gets the dark edge. */
export const OtpCells = forwardRef<
  TextInputInstance,
  { length: number; value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean }
>(function OtpCells({ length, value, onChange, invalid, disabled }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={formStyles.otpRow}>
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1);
        const filled = i < value.length;
        return (
          <View key={i} style={[formStyles.otpCell, filled && formStyles.otpFilled, active && formStyles.fieldFocus, invalid && formStyles.fieldError]}>
            <Text style={formStyles.otpDigit}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        // while disabled (checking the code) typing is ignored but the field keeps focus, so the
        // keyboard stays up instead of dropping and coming back
        onChangeText={(t) => {
          if (!disabled) onChange(t.replace(/\D/g, '').slice(0, length));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        style={[StyleSheet.absoluteFill, formStyles.otpHidden, noOutline]}
      />
    </View>
  );
});

export const formStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: FORM.field,
    paddingLeft: space.xl,
    paddingRight: space.lg,
    borderWidth: 1.25,
    borderColor: FORM.edge,
    // keeps whatever is inside (e.g. a browser's autofill fill) within the rounded ends
    overflow: 'hidden',
  },
  fieldFocus: { backgroundColor: FORM.field, borderColor: colors.ink },
  fieldError: { borderColor: colors.danger },
  fieldLocked: { backgroundColor: '#EFEDE8', borderColor: '#E6E4DE' },
  inputLocked: { color: colors.inkSoft },
  input: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.medium, fontSize: 16, color: colors.ink, backgroundColor: 'transparent' },
  divider: { width: 1, height: 26, backgroundColor: colors.lineStrong, marginHorizontal: space.md },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeLocked: {
    backgroundColor: colors.inkSoft,
  },
  helper: { ...text.caption, color: colors.inkSoft, marginTop: space.sm, paddingHorizontal: space.sm },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 18,
    backgroundColor: FORM.field,
    borderWidth: 1,
    borderColor: FORM.edge,
  },

  textAreaField: {
    minHeight: 116,
    borderRadius: 22,
    backgroundColor: FORM.field,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderWidth: 1.25,
    borderColor: FORM.edge,
  },
  textAreaInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },

  chips: { flexDirection: 'row', gap: 6, marginTop: space.lg },
  chip: { height: 44, borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  chipDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextOn: { fontFamily: fonts.semibold },

  otpRow: { flexDirection: 'row', gap: 8 },
  otpCell: { flex: 1, height: 56, borderRadius: 18, backgroundColor: FORM.field, borderWidth: 1.25, borderColor: FORM.edge, alignItems: 'center', justifyContent: 'center' },
  otpFilled: { backgroundColor: '#FFFFFF', borderColor: colors.lineStrong },
  otpDigit: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, fontVariant: ['tabular-nums'] },
  otpHidden: { opacity: 0.01, color: 'transparent' },
});
