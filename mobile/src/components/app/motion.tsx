import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { money } from '../../lib/format';

/** Entrance easing: a quick start and a long, soft landing. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

type WrapProps = { delay?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode };

/**
 * Counts each time the screen comes into focus. Pass it to Rise as `replay` so a tab's entrance plays every time you
 * open it, not only the first time (tabs stay mounted between visits).
 */
export function useFocusReplay() {
  const [n, setN] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setN((v) => v + 1);
    }, []),
  );
  return n;
}

/**
 * Fades its children in while lifting them into place on initial mount.
 * Keeps scale at 1 to prevent Android elevation shadow clipping and weird ghost boxes.
 */
export function Rise({ delay = 0, distance = 14, scale, replay = 0, style, children }: WrapProps & { distance?: number; scale?: number; replay?: number }) {
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  const t = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    if (!mounted.current) {
      mounted.current = true;
      t.value = 0;
      t.value = withDelay(delay, withTiming(1, { duration: 260, easing: EASE_OUT }));
    }
  }, [t, delay, reduced]);

  const anim = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * distance }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Springs its children up from a smaller scale: for badges, dots and discs. */
export function Pop({ delay = 0, from = 0.4, style, children }: WrapProps & { from?: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) t.value = withDelay(delay, withSpring(1, { damping: 13, stiffness: 190 }));
  }, [t, delay, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, t.value * 1.5), transform: [{ scale: from + (1 - from) * t.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

type RollingProps = {
  value: number;
  /** Must set lineHeight: each digit rolls through a window exactly that tall. */
  style: TextStyle & { lineHeight: number };
  format?: (n: number) => string;
  delay?: number;
};

/** An amount whose digits roll like an odometer: up from zero on mount, then to each new value. */
export function RollingNumber({ value, style, format = money, delay = 0 }: RollingProps) {
  const label = format(value);
  const chars = label.split('');
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
        {chars.map((c, i) => {
          const pos = chars.length - i; // keyed from the right, so units stay units as the number grows
          return /\d/.test(c) ? (
            <Digit key={`d${pos}`} digit={Number(c)} style={style} delay={delay + i * 45} />
          ) : (
            <Text key={`c${pos}`} style={style}>
              {c}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function Digit({ digit, style, delay }: { digit: number; style: RollingProps['style']; delay: number }) {
  const reduced = useReducedMotion();
  const h = style.lineHeight;
  const y = useSharedValue(reduced ? -digit * h : 0);
  useEffect(() => {
    const to = -digit * h;
    y.value = reduced ? to : withDelay(delay, withTiming(to, { duration: 900, easing: EASE_OUT }));
  }, [y, digit, h, delay, reduced]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      <Animated.View style={anim}>
        {DIGITS.map((d) => (
          <Text key={d} style={[style, { height: h }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
