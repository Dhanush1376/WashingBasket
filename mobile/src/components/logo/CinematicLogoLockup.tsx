import React, { forwardRef, memo, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts } from '../../theme';
import { AnimatedLogo, AnimatedLogoHandle } from './AnimatedLogo';

export const CINEMATIC_TIMELINE = {
  basket: 60,
  towel: 720,
  red: 1250,
  orange: 1780,
  /** Sparkles pop only AFTER clothes have fallen and settled into the basket */
  sparkles: 2270,
  /** Logo glides left and wordmark slowly reveals out from behind it to the right */
  reveal: 2850,
  /** Lockup settles into resting horizontal alignment (950ms reveal) */
  settled: 3800,
  /** Complete choreography cycle: holds for a full 2.0 seconds after animation settles! */
  complete: 5800,
} as const;

const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);

export type CinematicLogoLockupHandle = {
  finish: () => void;
};

type Props = {
  play: boolean;
  onComplete?: () => void;
  logoWidth?: number;
  fontSize?: number;
  enterFromX?: number;
};

/**
 * Cinematic brand lockup:
 * 1. Logo icon assembles EXACTLY at dead-center on screen (left-sliding basket, faster realistic falling clothes & towel shockwave).
 * 2. At 3100ms, the logo mark glides to the left while the title "WashingBasket" animates out from behind the logo
 *    towards the right (950ms smooth cinematic reveal).
 * 3. Both settle into a centered horizontal brand lockup and HOLD FOR 2 FULL SECONDS (until 6050ms).
 */
export const CinematicLogoLockup = memo(
  forwardRef<CinematicLogoLockupHandle, Props>(function CinematicLogoLockup(
    { play, onComplete, logoWidth = 82, fontSize = 24, enterFromX = 260 },
    ref,
  ) {
    const logoRef = React.useRef<AnimatedLogoHandle>(null);

    // Symmetric distance from lockup center:
    // With 82px logo, 12px gap, and ~168px text, lockup total width is ~262px.
    // Lockup center is at 131px. Logo center is at 41px.
    // Shift = 131 - 41 = 90px.
    // Logo starts at +90px (dead-center on screen).
    // Wordmark starts at -90px (dead-center directly behind logo, hidden).
    const SHIFT = 90;

    const logoX = useSharedValue(play ? SHIFT : 0);
    const wordmarkX = useSharedValue(play ? -SHIFT : 0);
    const wordmarkOpacity = useSharedValue(play ? 0 : 1);

    useEffect(() => {
      if (!play) {
        logoX.value = 0;
        wordmarkX.value = 0;
        wordmarkOpacity.value = 1;
        return;
      }

      // Initial state: logo at center (+SHIFT), wordmark behind logo (-SHIFT, opacity 0)
      logoX.value = SHIFT;
      wordmarkX.value = -SHIFT;
      wordmarkOpacity.value = 0;

      // ── Cinematic Reveal Phase (3100ms -> 4050ms: 950ms silky smooth animation) ──
      // 1. Logo glides from center (+SHIFT) to the left (0 in lockup row)
      logoX.value = withDelay(
        CINEMATIC_TIMELINE.reveal,
        withTiming(0, { duration: 950, easing: easeOutExpo }),
      );

      // 2. Wordmark slowly slides out from behind the logo (-SHIFT) to the right (0 in lockup row)
      wordmarkX.value = withDelay(
        CINEMATIC_TIMELINE.reveal,
        withTiming(0, { duration: 950, easing: easeOutExpo }),
      );

      // 3. Wordmark fades in smoothly as it emerges from behind the basket
      wordmarkOpacity.value = withDelay(
        CINEMATIC_TIMELINE.reveal + 80,
        withTiming(1, { duration: 650, easing: easeOutExpo }),
      );

      // 4. Holds at rest for 2.0 full seconds (from 4050ms to 6050ms) before onComplete
      const completeTimer = setTimeout(() => {
        onComplete?.();
      }, CINEMATIC_TIMELINE.complete);

      return () => {
        cancelAnimation(logoX);
        cancelAnimation(wordmarkX);
        cancelAnimation(wordmarkOpacity);
        clearTimeout(completeTimer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [play]);

    useImperativeHandle(ref, () => ({
      finish() {
        logoRef.current?.finish();
        cancelAnimation(logoX);
        cancelAnimation(wordmarkX);
        cancelAnimation(wordmarkOpacity);
        logoX.value = 0;
        wordmarkX.value = 0;
        wordmarkOpacity.value = 1;
        onComplete?.();
      },
    }));

    const logoAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: logoX.value }],
    }));

    const wordmarkAnimatedStyle = useAnimatedStyle(() => ({
      opacity: wordmarkOpacity.value,
      transform: [{ translateX: wordmarkX.value }],
    }));

    return (
      <View style={styles.outerStage} pointerEvents="box-none">
        <View style={styles.lockupRow} pointerEvents="box-none">
          {/* Logo Icon (Z-index 10: starts shifted +SHIFT so it is DEAD-CENTER in viewport) */}
          <Animated.View style={[styles.logoWrap, { width: logoWidth }, logoAnimatedStyle]}>
            <AnimatedLogo
              ref={logoRef}
              width={logoWidth}
              play={play}
              enterFromX={enterFromX}
            />
          </Animated.View>

          {/* Wordmark (Z-index 5: starts shifted -SHIFT so it is directly behind the logo at dead-center) */}
          <Animated.View style={[styles.wordmarkWrap, wordmarkAnimatedStyle]} pointerEvents="none">
            <Text
              numberOfLines={1}
              style={[styles.brandText, { fontSize, lineHeight: Math.round(fontSize * 1.3) }]}
            >
              <Text style={[styles.capLetter, { fontSize: Math.round(fontSize * 1.22) }]}>W</Text>ashing
              <Text style={[styles.capLetter, { fontSize: Math.round(fontSize * 1.22) }]}>B</Text>asket
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  outerStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoWrap: {
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkWrap: {
    zIndex: 5,
    marginLeft: 12,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    overflow: 'visible',
  },
  brandText: {
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    color: '#0A1C3E',
    letterSpacing: -0.35,
    includeFontPadding: false,
    flexShrink: 0,
  },
  capLetter: {
    fontFamily: fonts.display,
    fontWeight: '800',
    color: '#0A1C3E',
  },
});
