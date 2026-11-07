import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { haptic } from '../../lib/haptics';
import { colors, fonts, space, text } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const WebPath = Path as any;

/** Total path length of the checkmark path M5 12.5l4.5 4.5L19 7.5 is ~20 units. 34 ensures complete offset */
const CHECK_PATH_LENGTH = 34;

export type SuccessTickBadgeProps = {
  title?: string;
  message?: string;
  size?: number; // diameter of the solid green badge (default: 64)
  onComplete?: () => void;
};

/**
 * PhonePe / Google Pay-grade fintech animated success tick:
 * 1. Halo & solid emerald disc enter with a smooth, authoritative ease (no cartoon wobble).
 * 2. White checkmark sweeps dynamically across the path with stroke-dashoffset animation.
 * 3. Subtle micro-settle recoil & expanding ripple pulse at the exact moment the stroke finishes.
 * 4. Crisp tactile haptic feedback on completion.
 * 5. Coordinated typography entrance.
 */
export function SuccessTickBadge({
  title,
  message,
  size = 64,
  onComplete,
}: SuccessTickBadgeProps) {
  const reduced = useReducedMotion();
  const [webDrawn, setWebDrawn] = useState(reduced);

  const haloSize = Math.round(size * 1.44); // 92px for size 64
  const iconSize = Math.round(size * 0.52); // ~33px for size 64

  // Animation values
  const badgeScale = useSharedValue(reduced ? 1 : 0.25);
  const badgeOpacity = useSharedValue(reduced ? 1 : 0);
  const haloScale = useSharedValue(reduced ? 1 : 0.6);
  const haloOpacity = useSharedValue(reduced ? 1 : 0);
  const rippleScale = useSharedValue(reduced ? 1 : 0.85);
  const rippleOpacity = useSharedValue(0);
  const tickDraw = useSharedValue(reduced ? 1 : 0);
  const titleOpacity = useSharedValue(reduced ? 1 : 0);
  const titleY = useSharedValue(reduced ? 0 : 8);
  const subOpacity = useSharedValue(reduced ? 1 : 0);
  const subY = useSharedValue(reduced ? 0 : 6);

  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }

    // 1. Snappy circle entrance: smooth deceleration, no cartoon wobble (0 - 280ms)
    badgeOpacity.value = withTiming(1, { duration: 180 });
    badgeScale.value = withTiming(1, {
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    haloOpacity.value = withTiming(1, { duration: 220 });
    haloScale.value = withTiming(1, {
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    // 2. Stroke-draw checkmark starts at 140ms and finishes at 410ms (duration 270ms)
    tickDraw.value = withDelay(
      140,
      withTiming(1, {
        duration: 270,
        easing: Easing.bezier(0.2, 0.9, 0.3, 1),
      })
    );

    // 3. Impact micro-recoil & ripple pulse right when tick draw finishes (at 410ms)
    badgeScale.value = withDelay(
      410,
      withSequence(
        withTiming(1.05, { duration: 75, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })
      )
    );

    rippleScale.value = withDelay(
      410,
      withTiming(1.36, {
        duration: 440,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      })
    );
    rippleOpacity.value = withDelay(
      410,
      withSequence(
        withTiming(0.65, { duration: 60 }),
        withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) })
      )
    );

    // 4. Smooth typography glide
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 280 }));
    titleY.value = withDelay(
      200,
      withTiming(0, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );

    subOpacity.value = withDelay(270, withTiming(1, { duration: 280 }));
    subY.value = withDelay(
      270,
      withTiming(0, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) })
    );

    // Trigger haptic precisely when the tick lands
    const hapticTimer = setTimeout(() => {
      haptic.success();
    }, 410);

    // Trigger onComplete callback if provided
    let completeTimer: NodeJS.Timeout | null = null;
    if (onComplete) {
      completeTimer = setTimeout(() => {
        onComplete();
      }, 550);
    }

    if (Platform.OS === 'web') {
      const webTimer = setTimeout(() => {
        setWebDrawn(true);
      }, 140);
      return () => {
        clearTimeout(webTimer);
        clearTimeout(hapticTimer);
        if (completeTimer) clearTimeout(completeTimer);
      };
    }

    return () => {
      clearTimeout(hapticTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [
    reduced,
    badgeOpacity,
    badgeScale,
    haloOpacity,
    haloScale,
    rippleOpacity,
    rippleScale,
    tickDraw,
    titleOpacity,
    titleY,
    subOpacity,
    subY,
    onComplete,
  ]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const subAnimStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
    transform: [{ translateY: subY.value }],
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - tickDraw.value),
  }));

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {/* Icon cluster */}
      <View style={{ width: haloSize, height: haloSize, alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft mint ambient halo */}
        <Animated.View
          style={[
            styles.halo,
            {
              width: haloSize,
              height: haloSize,
              borderRadius: haloSize / 2,
            },
            haloStyle,
          ]}
        />

        {/* Dynamic expanding ripple wave */}
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
            },
            rippleStyle,
          ]}
        />

        {/* Solid emerald badge */}
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
        >
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
            {Platform.OS === 'web' ? (
              <WebPath
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_PATH_LENGTH}
                strokeDashoffset={webDrawn ? 0 : CHECK_PATH_LENGTH}
                style={{
                  transition: 'stroke-dashoffset 270ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                }}
              />
            ) : (
              <AnimatedPath
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_PATH_LENGTH}
                animatedProps={checkProps}
              />
            )}
          </Svg>
        </Animated.View>
      </View>

      {/* Typography */}
      {title ? (
        <View style={styles.textContainer}>
          <Animated.Text
            style={[text.h1, styles.title, titleAnimStyle]}
            accessibilityRole="header"
          >
            {title}
          </Animated.Text>
          {message ? (
            <Animated.Text style={[text.body, styles.message, subAnimStyle]}>
              {message}
            </Animated.Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: space.xl,
  },
  halo: {
    position: 'absolute',
    backgroundColor: colors.successTint,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(18, 173, 43, 0.35)',
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 14px rgba(18, 173, 43, 0.28)',
      } as any,
    }),
  },
  textContainer: {
    alignItems: 'center',
    marginTop: space.lg,
    paddingHorizontal: space.md,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
});

