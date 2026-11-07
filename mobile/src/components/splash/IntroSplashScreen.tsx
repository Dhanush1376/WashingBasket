import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import {
  CINEMATIC_TIMELINE,
  CinematicLogoLockup,
  CinematicLogoLockupHandle,
} from '../logo/CinematicLogoLockup';

/**
 * Fullscreen clean cinematic intro animation that greets the user whenever opening the app.
 * Choreographs the basket arrival, clothes stacking, sparkle gleams, and cinematic horizontal brand reveal.
 */
export const IntroSplashScreen = memo(function IntroSplashScreen({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const logoW = Math.min(84, Math.max(78, Math.round(winW * 0.21)));
  const lockupRef = useRef<CinematicLogoLockupHandle>(null);
  const opacity = useSharedValue(1);
  const dismissing = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    lockupRef.current?.finish();
    opacity.value = withTiming(0, { duration: 380 });
    setTimeout(onFinish, 400);
  }, [opacity, onFinish]);

  // Auto-finish after the cinematic lockup settles
  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss();
    }, CINEMATIC_TIMELINE.complete + 500);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, animatedStyle]} pointerEvents="box-none">
      {/* Tap anywhere to dismiss and enter the app */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Enter app" />

      {/* Centered Cinematic Horizontal Brand Lockup */}
      <View style={styles.center} pointerEvents="box-none">
        <CinematicLogoLockup
          ref={lockupRef}
          play
          logoWidth={logoW}
          fontSize={24}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

