import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, CONTROL_HEIGHT, fonts, radius } from '../../theme';
import { Check } from './icons';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  successLabel?: string;
};

/**
 * Brand CTA button: solid brand orange, the same height and corner as the fields.
 */
export function PrimaryButton({ label, onPress, disabled, loading, success, successLabel = 'Verified' }: Props) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.02 }] }));
  const inactive = loading || success;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!success, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 90 }))}
      onPressOut={() => (pressed.value = withSpring(0, { duration: 300, dampingRatio: 0.7 }))}
    >
      {({ pressed: isPressed }) => (
        <Animated.View
          style={[
            styles.button,
            success && styles.success,
            isPressed && !inactive && styles.pressed,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" accessibilityLabel="Loading" />
          ) : success ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.row}>
              <Check color="#FFFFFF" strokeWidth={2.8} />
              <Text style={styles.label}>{successLabel}</Text>
            </Animated.View>
          ) : (
            <View style={styles.row}>
              <Text style={styles.label}>{label}</Text>
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.button,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    // a crisp neutral lift and a faint top highlight, not a coloured glow
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        } as any)
      : {
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 1,
        }),
  },
  pressed: {
    backgroundColor: colors.ctaPressed,
  },
  success: { backgroundColor: colors.success },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15.5,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
});
