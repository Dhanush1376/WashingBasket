import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, type } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const WebPath = Path as any;
const CHECK_LENGTH = 34;

const ENTER_MS = 460;
const DRAW_MS = 420;
const EXPAND_START = 1050;
const EXPAND_MS = 560;
const FADE_START = 1580;
const FADE_MS = 420;

type Props = { title: string; message?: string; size?: number };

/**
 * Success choreography:
 * 1. Prominent green circle badge pops into center with a soft halo.
 * 2. Crisp white checkmark draws itself inside the green circle.
 * 3. Only the green circle expands outward to fill the screen; the tick keeps its size on top.
 * 4. Fades off smoothly as the flow transitions to the next step.
 */
export function VerificationSuccess({ title, message, size = 112 }: Props) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  // large enough to fill every corner of the screen when expanded
  const maxScale = Math.ceil((Math.hypot(width, height) / size) * 2.4);

  const [webDrawn, setWebDrawn] = useState(reduced);

  const badgeScale = useSharedValue(reduced ? 1 : 0.25);
  const badgeOpacity = useSharedValue(reduced ? 1 : 0);
  const haloOpacity = useSharedValue(reduced ? 1 : 0);
  const draw = useSharedValue(reduced ? 1 : 0);
  const textOpacity = useSharedValue(reduced ? 1 : 0);
  const rootOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;

    // 1. Entrance: Green badge pops into center
    badgeOpacity.value = withTiming(1, { duration: 220 });
    badgeScale.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    haloOpacity.value = withTiming(1, { duration: ENTER_MS });

    // 2. White tick draws itself inside the circle
    draw.value = withDelay(
      140,
      withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) })
    );

    // 3. Title and message fade in below
    textOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );

    // 4. Halo & text fade out right before full-screen expansion
    haloOpacity.value = withDelay(EXPAND_START - 80, withTiming(0, { duration: 180 }));
    textOpacity.value = withDelay(EXPAND_START - 80, withTiming(0, { duration: 180 }));

    // 5. Green circle + tick expands outward to occupy full screen
    badgeScale.value = withDelay(
      EXPAND_START,
      withTiming(maxScale, {
        duration: EXPAND_MS,
        easing: Easing.bezier(0.42, 0, 0.15, 1),
      })
    );

    // 6. Full screen fades off smoothly
    rootOpacity.value = withDelay(
      FADE_START,
      withTiming(0, {
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
      })
    );

    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        setWebDrawn(true);
      }, 140);
      return () => clearTimeout(timer);
    }
  }, [reduced, badgeOpacity, badgeScale, haloOpacity, draw, textOpacity, rootOpacity, maxScale]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  // the tick follows the badge's entrance pop, but never its full-screen zoom
  const tickStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: Math.min(badgeScale.value, 1) }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 10 }],
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - draw.value),
  }));

  return (
    <Animated.View
      style={[styles.wrap, rootStyle]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message ?? ''}`}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft outer halo */}
        <Animated.View
          style={[
            styles.halo,
            { width: size + 36, height: size + 36, borderRadius: (size + 36) / 2 },
            haloStyle,
          ]}
        />

        {/* The green circle: this alone expands to fill the screen */}
        <Animated.View
          style={[
            styles.badge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            badgeStyle,
          ]}
        />

        {/* The checkmark sits above the circle at a fixed size */}
        <Animated.View style={[styles.tick, tickStyle]} pointerEvents="none">
          <Svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none">
            {Platform.OS === 'web' ? (
              <WebPath
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_LENGTH}
                strokeDashoffset={webDrawn ? 0 : CHECK_LENGTH}
                style={{
                  transition: `stroke-dashoffset ${DRAW_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              />
            ) : (
              <AnimatedPath
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_LENGTH}
                animatedProps={checkProps}
              />
            )}
          </Svg>
        </Animated.View>
      </View>

      <Animated.View style={[styles.text, textStyle]}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 28 },
  halo: { position: 'absolute', backgroundColor: colors.successTint },
  badge: { position: 'absolute', backgroundColor: colors.success },
  tick: { alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', gap: 6 },
  title: { ...type.title, fontSize: 23, lineHeight: 29, textAlign: 'center' },
  message: { ...type.subtitle, textAlign: 'center' },
});
