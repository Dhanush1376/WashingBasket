import React, { forwardRef, memo, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../theme';
import { LogoLayer } from './LogoLayer';
import { LOGO_VIEWBOX } from './logoGeometry';
import { LOGO_ASPECT } from './WashingBasketLogo';

/** Choreography start times in ms, measured from the moment `play` begins. */
export const INTRO_TIMELINE = {
  basket: 50,
  towel: 560,
  red: 980,
  orange: 1400,
  sparkleLarge: 1790,
  sparkleSmall: 1910,
  /** Cinematic reveal: logo glides left and wordmark reveals right */
  wordmark: 2250,
  /** Complete choreography cycle including rest hold */
  complete: 4400,
} as const;

const T = INTRO_TIMELINE;
const LOADER_DURATION = 1500; // Faster, punchy clothes drop phase (snappy)
const FALL = 0.15; // A cloth fall takes ~285ms (accelerating gravity)
const RED_AT = 0.28;
const ORANGE_AT = 0.56;

const easeDecel = Easing.bezier(0.22, 1, 0.36, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

const ORIGIN_BOTTOM = { transformOrigin: '50% 100%' };
const ORIGIN_TOP = { transformOrigin: '50% 0%' };

// Basket floor line in logo space, used to seat the contact shadow.
const BASKET_FLOOR_Y = 990;
const SHADOW_W = 0.62;
const SHADOW_H = 0.07;

export type AnimatedLogoHandle = {
  /** Jumps every element to its resting position (used when the user skips). */
  finish: () => void;
};

type Props = {
  /** Rendered width in px; height follows the logo aspect ratio. */
  width: number;
  /** When false the logo is rendered already assembled. */
  play: boolean;
  /** Horizontal distance (px) the basket travels in. Negative = slides from left. */
  enterFromX: number;
};

/** 0 → 1 across [from, to] of the cycle, clamped. */
function seg(t: number, from: number, to: number) {
  'worklet';
  return interpolate(t, [from, to], [0, 1], 'clamp');
}

export const AnimatedLogo = memo(
  forwardRef<AnimatedLogoHandle, Props>(function AnimatedLogo({ width, play, enterFromX }, ref) {
    const W = width;
    const H = W * LOGO_ASPECT;
    const drop = W * 0.22; // How far a cloth falls into the basket
    const p = (from: number, rest: number) => (play ? from : rest);

    // Shared values
    const basketX = useSharedValue(p(enterFromX, 0));
    const basketTilt = useSharedValue(p(enterFromX > 0 ? -2.6 : 2.6, 0));
    const shadow = useSharedValue(p(1, 0));

    // Master progress for the loader animation sequence (0 to 1)
    const loaderT = useSharedValue(p(0, 1));

    useEffect(() => {
      if (!play) return;

      // Phase 1 — Basket glides in smoothly from the RIGHT (or left if negative enterFromX),
      // tilting naturally with momentum and settling upright onto its base.
      const tiltDir = enterFromX > 0 ? -1 : 1;
      basketX.value = withDelay(T.basket, withTiming(0, { duration: 480, easing: easeDecel }));
      basketTilt.value = withDelay(
        T.basket,
        withSequence(
          withTiming(tiltDir * 2.6, { duration: 250, easing: Easing.out(Easing.quad) }),
          withTiming(tiltDir * -0.8, { duration: 140, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 90, easing: Easing.out(Easing.quad) }),
        ),
      );

      // Phase 2 — Loader clothes animation starts once basket is seated
      loaderT.value = withDelay(
        T.towel,
        withTiming(1, { duration: LOADER_DURATION, easing: Easing.linear }),
      );

      shadow.value = withDelay(T.complete, withTiming(0, { duration: 500, easing: easeInOut }));

      return () => {
        cancelAnimation(basketX);
        cancelAnimation(basketTilt);
        cancelAnimation(loaderT);
        cancelAnimation(shadow);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [play]);

    useImperativeHandle(ref, () => ({
      finish() {
        cancelAnimation(basketX);
        cancelAnimation(basketTilt);
        cancelAnimation(loaderT);
        cancelAnimation(shadow);
        basketX.value = 0;
        basketTilt.value = 0;
        loaderT.value = 1;
        shadow.value = 0;
      },
    }));

    // The basket's responsive give when a cloth lands: it sinks, springs back a little, and settles
    const give = (v: number, at: number) => {
      'worklet';
      const d = seg(v, at, at + 0.20);
      return d > 0 && d < 1 ? Math.exp(-5.5 * d) * Math.cos(Math.PI * 3 * d) : 0;
    };

    // A cloth falls like a real one: gravity accelerating fall (k*k), slight aerodynamic tilt that
    // straightens; on impact it compresses deeply like real fabric (squash) and gives a cushioned rebound before settling.
    const cloth = (v: number, from: number, tilt: number) => {
      'worklet';
      if (v < from) return { opacity: 0, transform: [{ translateY: -drop * 1.6 }] };
      const k = seg(v, from, from + FALL);
      const fall = k * k; // accelerating gravity
      const r = seg(v, from + FALL, from + FALL + 0.14); // after it lands
      const rebound = Math.sin(Math.PI * Math.min(1, r * 1.6)) * (1 - r) * drop * 0.14;
      const squash = Math.exp(-6.5 * r) * Math.cos(Math.PI * 2.5 * r) * (r > 0 ? 1 : 0);
      return {
        opacity: Math.min(1, k * 5),
        transformOrigin: 'bottom',
        transform: [
          { translateY: -(1 - fall) * drop * 1.6 - rebound },
          { rotate: `${(1 - fall) * tilt}deg` },
          { scaleY: 1 - squash * 0.22 },
          { scaleX: 1 + squash * 0.11 },
        ],
      };
    };

    const sparkle = (v: number, from: number) => {
      'worklet';
      if (v < from) return { opacity: 0, transform: [{ scale: 0 }] };
      const k = seg(v, from, from + 0.12);
      const pop = k < 1 ? 0.4 + k * 0.75 : 1.15 - seg(v, from + 0.12, from + 0.22) * 0.15;
      return {
        opacity: Math.min(1, k * 2.5),
        transform: [{ scale: Math.max(0, pop) }, { rotate: `${(1 - Math.min(1, k)) * -45}deg` }],
      };
    };

    const basketStyle = useAnimatedStyle(() => {
      const v = loaderT.value;
      const g = give(v, RED_AT + FALL) + give(v, ORANGE_AT + FALL);
      return {
        transformOrigin: 'bottom',
        transform: [
          { translateX: basketX.value },
          { translateY: g * W * 0.045 },
          { rotate: `${basketTilt.value}deg` },
          { scaleY: 1 - g * 0.07 },
          { scaleX: 1 + g * 0.035 },
        ],
      };
    });

    const towelStyle = useAnimatedStyle(() => {
      const v = loaderT.value;
      if (v < 0.001) return { opacity: 0 };

      // Phase 1: Unroll over the rim (v: 0.0 -> 0.12)
      const k = seg(v, 0.0, 0.12);
      const unroll = 1 - Math.pow(1 - k, 2.4);

      // Phase 1b: Initial drape settle & sway on the rim (until red cloth drops at 0.25)
      const r0 = seg(v, 0.12, 0.25);
      const settle0 = r0 > 0 && r0 < 1 ? Math.exp(-4.5 * r0) : 0;
      const stretch0 = settle0 * Math.sin(Math.PI * 2 * r0) * 0.1;
      const sway0 = settle0 * Math.sin(Math.PI * 3 * r0) * 9;

      // Phase 2: Red cloth impact bounce (v: RED_AT + FALL -> RED_AT + FALL + 0.22)
      // When red cloth slams in, towel flap stretches down under inertia, rebounds up, and sways
      const r1 = seg(v, RED_AT + FALL, RED_AT + FALL + 0.22);
      const jolt1 = r1 > 0 && r1 < 1 ? Math.exp(-5.5 * r1) : 0;
      const stretch1 = jolt1 * Math.sin(Math.PI * 3 * r1) * 0.22;
      const sway1 = jolt1 * Math.sin(Math.PI * 3.5 * r1) * 8.5;
      const bounceY1 = jolt1 * Math.sin(Math.PI * 2.5 * r1) * (W * 0.02);

      // Phase 3: Orange cloth impact bounce (v: ORANGE_AT + FALL -> ORANGE_AT + FALL + 0.22)
      // Second impact shockwave bounce
      const r2 = seg(v, ORANGE_AT + FALL, ORANGE_AT + FALL + 0.22);
      const jolt2 = r2 > 0 && r2 < 1 ? Math.exp(-5.5 * r2) : 0;
      const stretch2 = jolt2 * Math.sin(Math.PI * 3 * r2) * 0.16;
      const sway2 = jolt2 * Math.sin(Math.PI * 3.5 * r2) * 6;
      const bounceY2 = jolt2 * Math.sin(Math.PI * 2.5 * r2) * (W * 0.015);

      const totalStretch = stretch0 + stretch1 + stretch2;
      const totalSway = sway0 + sway1 + sway2;
      const totalBounceY = bounceY1 + bounceY2;

      return {
        opacity: Math.min(1, k * 6),
        transformOrigin: 'top',
        transform: [
          { translateY: totalBounceY },
          { rotate: `${totalSway}deg` },
          { scaleY: Math.max(0.001, unroll + totalStretch) },
        ],
      };
    });

    const redStyle = useAnimatedStyle(() => {
      const v = loaderT.value;
      const base = cloth(v, RED_AT, -6);
      if (v < RED_AT) return base;
      const g2 = give(v, ORANGE_AT + FALL);
      return {
        ...base,
        transform: [
          ...(base.transform || []),
          { translateY: g2 * W * 0.035 },
          { scaleY: 1 - g2 * 0.04 },
        ],
      };
    });
    const orangeStyle = useAnimatedStyle(() => cloth(loaderT.value, ORANGE_AT, 5));
    // Sparkles appear strictly AFTER both clothes have completely fallen and settled into the basket
    const sparkleLargeStyle = useAnimatedStyle(() => sparkle(loaderT.value, 0.82));
    const sparkleSmallStyle = useAnimatedStyle(() => sparkle(loaderT.value, 0.89));

    const shadowStyle = useAnimatedStyle(() => {
      const arrive = 1 - Math.min(1, Math.abs(basketX.value) / (W * 0.8));
      return { opacity: arrive * shadow.value, transform: [{ translateX: basketX.value }, { scaleX: 0.7 + arrive * 0.3 }] };
    });

    const floorTop = ((BASKET_FLOOR_Y - LOGO_VIEWBOX.y) / LOGO_VIEWBOX.h) * H;

    return (
      <View accessible accessibilityRole="image" accessibilityLabel="Washing Basket" style={{ width: W, height: H }}>
        {/* Contact shadow */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: W * (0.5 - SHADOW_W / 2),
              top: floorTop - (W * SHADOW_H) / 2,
              width: W * SHADOW_W,
              height: W * SHADOW_H,
            },
            shadowStyle,
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="wbFloorShadow" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
                <Stop offset="0" stopColor={colors.ink} stopOpacity={0.22} />
                <Stop offset="0.45" stopColor={colors.ink} stopOpacity={0.12} />
                <Stop offset="0.8" stopColor={colors.ink} stopOpacity={0.03} />
                <Stop offset="1" stopColor={colors.ink} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="50" rx="50" ry="50" fill="url(#wbFloorShadow)" />
          </Svg>
        </Animated.View>

        {/* Logo Layers */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Basket & Towel group: towel is anchored to the basket rim so it rides the basket's slide, dip & squash */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ORIGIN_BOTTOM, basketStyle]}>
            <LogoLayer name="basket" width={W} />
            <LogoLayer name="towel" width={W} style={[ORIGIN_TOP, towelStyle]} />
          </Animated.View>
          <LogoLayer name="clothRed" width={W} style={[ORIGIN_BOTTOM, redStyle]} />
          <LogoLayer name="clothOrange" width={W} style={[ORIGIN_BOTTOM, orangeStyle]} />
          <LogoLayer name="sparkleLarge" width={W} style={sparkleLargeStyle} />
          <LogoLayer name="sparkleSmall" width={W} style={sparkleSmallStyle} />
        </View>
      </View>
    );
  }),
);
