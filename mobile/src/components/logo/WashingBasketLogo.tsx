import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../theme';
import { LayerName, layerFrame, LogoLayer } from './LogoLayer';
import { LOGO_VIEWBOX } from './logoGeometry';

export const LOGO_ASPECT = LOGO_VIEWBOX.h / LOGO_VIEWBOX.w;

/** Paint order of the assembled logo, back to front. */
export const LAYER_ORDER: LayerName[] = ['basket', 'towel', 'clothRed', 'clothOrange', 'sparkleLarge', 'sparkleSmall'];

const BODY_LAYERS: LayerName[] = ['basket', 'towel', 'clothRed', 'clothOrange'];

const CYCLE_MS = 3400; // repeating twinkle & shine period

export type WashingBasketLogoProps = {
  /** Rendered width in px; height automatically follows brand aspect ratio. */
  width: number;
  /** When true (default), the sparkles gently twinkle and shine periodically. */
  shine?: boolean;
};

/**
 * The completed logo.
 * The laundry basket and folded clothes sit resting in crisp brand colors,
 * while the fresh-clean sparkles gently gleam and shine in an organic, premium rhythm.
 */
export const WashingBasketLogo = memo(function WashingBasketLogo({ width, shine = true }: WashingBasketLogoProps) {
  const reducedMotion = useReducedMotion();
  const active = shine && !reducedMotion;

  // Single looping cycle (0 -> 1) drives synchronized sparkle gleams
  const cycle = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cycle.value = 0;
      return;
    }

    cycle.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1
    );

    return () => {
      cancelAnimation(cycle);
    };
  }, [active, cycle]);

  // Large sparkle: scales up, twists slightly, catches white light sheen & halo
  const largeStyle = useAnimatedStyle(() => {
    if (!active) return {};
    const v = cycle.value;
    const scale = interpolate(v, [0, 0.07, 0.15], [1, 1.25, 1], Extrapolation.CLAMP);
    const rotate = interpolate(v, [0, 0.07, 0.15], [0, 14, 0], Extrapolation.CLAMP);
    return {
      transformOrigin: '50% 50%',
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const largeSheenStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    const opacity = interpolate(cycle.value, [0, 0.06, 0.14], [0, 0.95, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  const largeHaloStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    const v = cycle.value;
    const scale = interpolate(v, [0, 0.07, 0.16], [0.6, 1.4, 1.6], Extrapolation.CLAMP);
    const opacity = interpolate(v, [0, 0.07, 0.16], [0, 0.65, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transformOrigin: '50% 50%',
      transform: [{ scale }],
    };
  });

  // Small sparkle: staggered reply twinkle (begins at v = 0.08, ~270ms later)
  const smallStyle = useAnimatedStyle(() => {
    if (!active) return {};
    const v = cycle.value;
    const scale = interpolate(v, [0.08, 0.16, 0.24], [1, 1.28, 1], Extrapolation.CLAMP);
    const rotate = interpolate(v, [0.08, 0.16, 0.24], [0, -18, 0], Extrapolation.CLAMP);
    return {
      transformOrigin: '50% 50%',
      transform: [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const smallSheenStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    const opacity = interpolate(cycle.value, [0.08, 0.15, 0.23], [0, 0.95, 0], Extrapolation.CLAMP);
    return { opacity };
  });

  const smallHaloStyle = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    const v = cycle.value;
    const scale = interpolate(v, [0.08, 0.16, 0.25], [0.6, 1.4, 1.6], Extrapolation.CLAMP);
    const opacity = interpolate(v, [0.08, 0.16, 0.25], [0, 0.7, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transformOrigin: '50% 50%',
      transform: [{ scale }],
    };
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Washing Basket"
      style={{ width, height: width * LOGO_ASPECT }}
    >
      {/* 1. Base body layers */}
      {BODY_LAYERS.map((name) => (
        <LogoLayer key={name} name={name} width={width} />
      ))}

      {/* 2. Sparkle halos (soft radiant light bloom centered on the stars) */}
      {active && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
              layerFrame('sparkleLarge', width),
              largeHaloStyle,
            ]}
          >
            <Svg width="140%" height="140%" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id="wbHaloL" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
                  <Stop offset="45%" stopColor="#4A90E2" stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={colors.navy} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="50" fill="url(#wbHaloL)" />
            </Svg>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
              layerFrame('sparkleSmall', width),
              smallHaloStyle,
            ]}
          >
            <Svg width="140%" height="140%" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id="wbHaloS" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
                  <Stop offset="45%" stopColor="#4A90E2" stopOpacity={0.3} />
                  <Stop offset="100%" stopColor={colors.navy} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="50" fill="url(#wbHaloS)" />
            </Svg>
          </Animated.View>
        </>
      )}

      {/* 3. Base navy star shapes */}
      <LogoLayer name="sparkleLarge" width={width} style={largeStyle} />
      <LogoLayer name="sparkleSmall" width={width} style={smallStyle} />

      {/* 4. White light-catch sheen flares */}
      {active && (
        <>
          <LogoLayer name="sparkleLarge" width={width} sheen style={[largeStyle, largeSheenStyle]} />
          <LogoLayer name="sparkleSmall" width={width} sheen style={[smallStyle, smallSheenStyle]} />
        </>
      )}
    </View>
  );
});
