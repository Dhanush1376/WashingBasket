import React, { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../../theme';
import { LogoLayer } from './LogoLayer';
import { LOGO_ASPECT } from './WashingBasketLogo';

/**
 * Loading indicator: just the logo, no ring, filling itself up on a loop. The blue towel drapes over the rim, then,
 * with a pause between them, the red cloth falls in and the orange one on top; the basket dips once, softly, as each
 * cloth lands. The two sparkles pop on, it holds a beat, then the pieces fade out and it starts again. A thin bar
 * slides along underneath, so it always reads as "working".
 */

const CYCLE_MS = 3000; // long enough for a clear pause between each cloth falling in
const FALL = 0.12; // a fall takes this share of the cycle (360ms)
const RED_AT = 0.16;
const ORANGE_AT = 0.42; // a beat after the red one has settled
const BAR_MS = 1100;

type Props = {
  /** Width of the logo in px. */
  size?: number;
};

/** 0 → 1 across [from, to] of the cycle, clamped. */
function seg(t: number, from: number, to: number) {
  'worklet';
  return interpolate(t, [from, to], [0, 1], 'clamp');
}

export const LogoLoader = memo(function LogoLoader({ size = 64 }: Props) {
  const reduceMotion = useReducedMotion();
  const logoW = size;
  const logoH = logoW * LOGO_ASPECT;
  const drop = size * 0.16; // how far a cloth falls into the basket
  const barW = Math.round(size * 0.62);
  const barSeg = Math.round(barW * 0.38);

  const t = useSharedValue(0); // one fill-and-clear cycle
  const bar = useSharedValue(0);

  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: reduceMotion ? 2400 : CYCLE_MS, easing: Easing.linear }), -1));
    bar.set(withRepeat(withTiming(1, { duration: BAR_MS, easing: Easing.bezier(0.45, 0, 0.55, 1) }), -1));
    return () => {
      cancelAnimation(t);
      cancelAnimation(bar);
    };
  }, [reduceMotion, t, bar]);

  // everything that comes in clears together near the end of the cycle
  const clear = (v: number) => {
    'worklet';
    return 1 - seg(v, 0.84, 0.96);
  };
  // a cloth falls like a real one: slow to start, quicker as it drops (gravity, not a glide), a slight tilt that
  // straightens as it comes down; on landing it squashes a touch and gives one small rebound before it settles
  const cloth = (v: number, from: number, tilt: number) => {
    'worklet';
    if (reduceMotion) return { opacity: seg(v, from, from + FALL) * clear(v) };
    const k = seg(v, from, from + FALL);
    const fall = k * k; // accelerating
    const r = seg(v, from + FALL, from + FALL + 0.1); // after it lands
    const rebound = Math.sin(Math.PI * Math.min(1, r * 1.6)) * (1 - r) * drop * 0.16;
    const squash = Math.exp(-6 * r) * Math.cos(Math.PI * 2.5 * r) * (r > 0 ? 1 : 0);
    return {
      opacity: Math.min(1, k * 5) * clear(v),
      transformOrigin: 'bottom',
      transform: [
        { translateY: -(1 - fall) * drop * 1.5 - rebound },
        { rotate: `${(1 - fall) * tilt}deg` },
        { scaleY: 1 - squash * 0.12 },
        { scaleX: 1 + squash * 0.06 },
      ],
    };
  };
  const sparkle = (v: number, from: number) => {
    'worklet';
    const k = seg(v, from, from + 0.12);
    const pop = k < 1 ? 0.4 + k * 0.75 : 1.15 - seg(v, from + 0.12, from + 0.2) * 0.15; // overshoots, then settles
    return {
      opacity: k * clear(v),
      transform: reduceMotion ? [] : [{ scale: pop }, { rotate: `${(1 - k) * -45}deg` }],
    };
  };

  // the basket's give when a cloth lands: it sinks, springs back a little past rest, and settles, like a damped spring
  const give = (v: number, at: number) => {
    'worklet';
    const d = seg(v, at, at + 0.18);
    return d > 0 && d < 1 ? Math.exp(-5 * d) * Math.cos(Math.PI * 3 * d) : 0;
  };

  // the basket only moves when a cloth lands in it, and otherwise holds still
  const basketStyle = useAnimatedStyle(() => {
    const v = t.get();
    if (reduceMotion) return {};
    const g = give(v, RED_AT + FALL) + give(v, ORANGE_AT + FALL);
    return {
      transformOrigin: 'bottom',
      transform: [{ translateY: g * size * 0.03 }, { scaleY: 1 - g * 0.06 }, { scaleX: 1 + g * 0.03 }],
    };
  });
  const towelStyle = useAnimatedStyle(() => {
    const v = t.get();
    // draped over the rim from the far side, like a towel thrown over a rail: it unrolls down from the rim's edge
    // (growing from its top), runs a touch past full length under its own weight, springs back, and sways on the
    // rim a couple of times before it hangs still
    const k = seg(v, 0.0, 0.1);
    const unroll = 1 - Math.pow(1 - k, 2.4);
    const r = seg(v, 0.1, 0.3); // after it has unrolled
    const settle = r > 0 && r < 1 ? Math.exp(-4.5 * r) : 0;
    const stretch = settle * Math.sin(Math.PI * 2 * r) * 0.1; // overshoots its length, then pulls back
    const sway = settle * Math.sin(Math.PI * 3 * r) * 9; // degrees, around the rim
    if (reduceMotion) return { opacity: k * clear(v) };
    return {
      opacity: Math.min(1, k * 6) * clear(v),
      transformOrigin: 'top',
      transform: [{ rotate: `${sway}deg` }, { scaleY: Math.max(0.001, unroll + stretch) }],
    };
  });
  const redStyle = useAnimatedStyle(() => cloth(t.get(), RED_AT, -6));
  const orangeStyle = useAnimatedStyle(() => cloth(t.get(), ORANGE_AT, 5));
  const bigStyle = useAnimatedStyle(() => sparkle(t.get(), 0.64));
  const smallStyle = useAnimatedStyle(() => sparkle(t.get(), 0.71));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -barSeg + bar.get() * (barW + barSeg) }] }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {/* a light, soft shadow follows the logo's own shape, so it stands clear of whatever is behind it */}
      <Animated.View style={[{ width: logoW, height: logoH }, styles.lift, basketStyle]}>
        <LogoLayer name="basket" width={logoW} />
        <LogoLayer name="towel" width={logoW} style={towelStyle} />
        <LogoLayer name="clothRed" width={logoW} style={redStyle} />
        <LogoLayer name="clothOrange" width={logoW} style={orangeStyle} />
        <LogoLayer name="sparkleLarge" width={logoW} style={bigStyle} />
        <LogoLayer name="sparkleSmall" width={logoW} style={smallStyle} />
      </Animated.View>
      <View style={[styles.track, { width: barW, marginTop: Math.round(size * 0.26) }]}>
        <Animated.View style={[styles.fill, { width: barSeg }, barStyle]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  lift:
    Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 2px 2px rgba(25, 18, 8, 0.14)) drop-shadow(0 6px 10px rgba(25, 18, 8, 0.1))' } as object)
      : { shadowColor: '#19120A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(10, 28, 62, 0.1)' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.orange },
});

/** Compact inline loader: three brand-colour dots rising in a gentle wave. */
export const LoadingDots = memo(function LoadingDots({ size = 8 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: reduceMotion ? 1800 : 1200, easing: Easing.linear }), -1);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  return (
    <View style={[dotStyles.row, { gap: size * 0.75 }]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {[colors.navy, colors.orange, colors.red].map((c, i) => (
        <Dot key={c} color={c} index={i} t={t} size={size} still={reduceMotion} />
      ))}
    </View>
  );
});

function Dot({
  color,
  index,
  t,
  size,
  still,
}: {
  color: string;
  index: number;
  t: ReturnType<typeof useSharedValue<number>>;
  size: number;
  still: boolean;
}) {
  const style = useAnimatedStyle(() => {
    // each dot is a third of a cycle behind the one before it
    const phase = (t.value - index / 3 + 1) % 1;
    const wave = Math.sin(Math.PI * Math.min(1, phase / 0.6)) * (phase < 0.6 ? 1 : 0);
    return {
      opacity: 0.35 + wave * 0.65,
      transform: [{ translateY: still ? 0 : -wave * size * 0.6 }, { scale: 0.85 + wave * 0.15 }],
    };
  });
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
