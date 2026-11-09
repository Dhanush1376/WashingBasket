import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { haptic } from '../../lib/haptics';
import { colors, fonts, space } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const WebCircle = Circle as any;
const WebPath = Path as any;

/** The tick, in a 24-unit box: two strokes, about 17.1 units long in all. */
const CHECK = 'M6.5 12.5l3.8 3.8L17.8 8.6';
const CHECK_LEN = 18;
const STROKE = 3;
/** A soft, confident ease-out: no overshoot, no bounce. */
const EASE = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_CSS = 'cubic-bezier(0.33, 1, 0.68, 1)';

// Timeline (ms): the ring draws, fills, then the tick draws; the title follows.
const RING = { at: 0, ms: 420 };
const FILL = { at: 300, ms: 260 };
const TICK = { at: 470, ms: 260 };
const TITLE = { at: 420, ms: 260 };

export type SuccessTickBadgeProps = {
  title?: string;
  /** Optional second line; kept short (the sign-in flow uses none). */
  message?: string;
  /** Diameter of the badge (default 88). */
  size?: number;
  onComplete?: () => void;
};

/**
 * The "done" moment: a thin green ring draws itself round, fills, and a white tick draws
 * across it. One even motion with no halo, ripple or bounce, then a short title.
 */
export function SuccessTickBadge({ title, message, size = 88, onComplete }: SuccessTickBadgeProps) {
  const reduced = useReducedMotion();
  const web = Platform.OS === 'web';
  const r = (size - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  const ring = useSharedValue(reduced ? 1 : 0);
  const fill = useSharedValue(reduced ? 1 : 0);
  const tick = useSharedValue(reduced ? 1 : 0);
  const words = useSharedValue(reduced ? 1 : 0);
  // web draws the strokes with CSS transitions instead of animated SVG props
  const [webStage, setWebStage] = useState(reduced ? 2 : 0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduced) {
      if (onComplete) timers.push(setTimeout(onComplete, 0));
      return () => timers.forEach(clearTimeout);
    }
    ring.value = withDelay(RING.at, withTiming(1, { duration: RING.ms, easing: EASE }));
    fill.value = withDelay(FILL.at, withTiming(1, { duration: FILL.ms, easing: EASE }));
    tick.value = withDelay(TICK.at, withTiming(1, { duration: TICK.ms, easing: EASE }));
    words.value = withDelay(TITLE.at, withTiming(1, { duration: TITLE.ms, easing: EASE }));
    if (web) {
      timers.push(setTimeout(() => setWebStage(1), 16));
      timers.push(setTimeout(() => setWebStage(2), TICK.at));
    }
    // the tap lands as the tick finishes
    timers.push(setTimeout(() => haptic.success(), TICK.at + TICK.ms - 60));
    if (onComplete) timers.push(setTimeout(onComplete, TICK.at + TICK.ms));
    return () => timers.forEach(clearTimeout);
  }, [reduced, web, ring, fill, tick, words, onComplete]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - ring.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - tick.value) }));
  const discStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.86 + 0.14 * fill.value }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: words.value, transform: [{ translateY: (1 - words.value) * 6 }] }));

  const tickSize = Math.round(size * 0.62);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite" accessibilityLabel={title}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.disc, { borderRadius: size / 2 }, discStyle]} />
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
          {web ? (
            <WebCircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors.success}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={webStage >= 1 ? 0 : circ}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: `stroke-dashoffset ${RING.ms}ms ${EASE_CSS}` }}
            />
          ) : (
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors.success}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circ}
              animatedProps={ringProps}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Svg width={tickSize} height={tickSize} viewBox="0 0 24 24" fill="none">
            {web ? (
              <WebPath
                d={CHECK}
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_LEN}
                strokeDashoffset={webStage >= 2 ? 0 : CHECK_LEN}
                style={{ transition: `stroke-dashoffset ${TICK.ms}ms ${EASE_CSS}` }}
              />
            ) : (
              <AnimatedPath
                d={CHECK}
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_LEN}
                animatedProps={tickProps}
              />
            )}
          </Svg>
        </View>
      </View>

      {title ? (
        <Animated.View style={[styles.words, wordsStyle]}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          {message ? (
            <Text style={styles.message} numberOfLines={1}>
              {message}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: space.lg },
  disc: { backgroundColor: colors.success },
  center: { alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', marginTop: space.lg, paddingHorizontal: space.md },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.ink, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center', marginTop: 3 },
});
