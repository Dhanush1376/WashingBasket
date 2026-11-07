import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, CONTROL_HEIGHT, fonts } from '../../theme';

/** Border width shared by the outlined fields, so the label lands exactly on the line. */
export const FIELD_BORDER = 1; // a whole pixel: fractional borders render soft and uneven at the corners
const LINE_H = 20;
const FLOAT_SCALE = 0.78;

type Props = {
  label: string;
  /** Focused or holding a value: the label sits on the top border. */
  raised: boolean;
  focused: boolean;
  error?: boolean;
  /** Left edge of the label while it rests inside the field (px from the field's inner edge). */
  restLeft: number;
  /** Left edge once raised onto the border. */
  floatLeft?: number;
};

/**
 * Outlined-field label: rests inside the field like a placeholder, then glides up and shrinks
 * into a gap in the top border when the field is focused or filled.
 */
export function FloatingLabel({ label, raised, focused, error, restLeft, floatLeft = 12 }: Props) {
  const t = useSharedValue(raised ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(raised ? 1 : 0, { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [raised, t]);

  const inner = CONTROL_HEIGHT - FIELD_BORDER * 2;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [restLeft - floatLeft, 0]) },
      { translateY: interpolate(t.value, [0, 1], [0, -(inner / 2 + FIELD_BORDER / 2)]) },
      { scale: interpolate(t.value, [0, 1], [1, FLOAT_SCALE]) },
    ],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      numberOfLines={1}
      style={[
        styles.label,
        { left: floatLeft, top: (inner - LINE_H) / 2 },
        raised && focused && styles.focused,
        error && styles.error,
        style,
      ]}
    >
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    paddingHorizontal: 4,
    backgroundColor: colors.background, // cuts the gap in the border line
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: LINE_H,
    color: '#6B7280', // a placeholder that is actually readable
    transformOrigin: 'left center',
  },
  focused: { color: colors.navy, fontFamily: fonts.medium },
  error: { color: colors.danger },
});
