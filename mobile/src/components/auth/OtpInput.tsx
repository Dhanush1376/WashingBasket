import React, { forwardRef, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radius } from '../../theme';

type Props = {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
};

function Caret() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.caret, style]} />;
}

/** Six boxes driven by one hidden TextInput, so paste and SMS autofill work. */
export const OtpInput = forwardRef<TextInputInstance, Props>(function OtpInput(
  { length = 6, value, onChange, invalid, disabled },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inputRef = React.useRef<TextInputInstance>(null);
  React.useImperativeHandle(ref, () => inputRef.current as TextInputInstance);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = focused && !disabled && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                char !== undefined && styles.filled,
                active && styles.active,
                invalid && styles.invalid,
              ]}
            >
              {char !== undefined ? <Text style={styles.digit}>{char}</Text> : active ? <Caret /> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        style={[
          styles.hidden,
          Platform.OS === 'web' && ({ outlineStyle: 'none', outline: 'none' } as any),
        ]}
        accessibilityLabel={`Verification code, ${length} digits`}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    maxWidth: 58,
    aspectRatio: 0.86,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 4px rgba(20, 33, 61, 0.08)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        } as any)
      : {
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 1,
        }),
  },
  filled: {
    borderColor: colors.cta,
    backgroundColor: colors.ctaTint,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 4px rgba(254, 135, 1, 0.12)',
        } as any)
      : {}),
  },
  active: {
    borderColor: colors.cta,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px ' + colors.cta + ', 0 2px 6px rgba(254, 135, 1, 0.18)',
        } as any)
      : {}),
  },
  invalid: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px ' + colors.danger,
        } as any)
      : {}),
  },
  digit: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink },
  caret: { width: 2, height: 24, borderRadius: 1, backgroundColor: colors.cta },
  hidden: { ...StyleSheet.absoluteFill, opacity: 0, color: 'transparent' },
});
