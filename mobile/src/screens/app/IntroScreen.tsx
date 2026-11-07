import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CINEMATIC_TIMELINE,
  CinematicLogoLockup,
  CinematicLogoLockupHandle,
} from '../../components/logo/CinematicLogoLockup';
import { haptic } from '../../lib/haptics';
import type { ScreenProps } from '../../navigation/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

// Rest pause at the end of each intro cycle before restarting (1.2 seconds)
const LOOP_PAUSE_MS = 1200;

export function IntroScreen({ navigation }: Partial<ScreenProps<'Intro'>>) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Logo width reduced to ~82px (universal app logo size, requested)
  const logoW = Math.min(84, Math.max(78, Math.round(winW * 0.21)));

  const [runKey, setRunKey] = useState(0);
  const lockupRef = useRef<CinematicLogoLockupHandle>(null);

  // Animate and loop automatically
  useEffect(() => {
    // When the animation completes + rest pause, automatically loop back to 0
    const loopTimer = setTimeout(() => {
      setRunKey((k) => k + 1);
    }, CINEMATIC_TIMELINE.complete + LOOP_PAUSE_MS);

    return () => {
      clearTimeout(loopTimer);
    };
  }, [runKey]);

  const goBack = useCallback(() => {
    haptic.tap();
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('Main', { screen: 'Home' });
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.search = '';
    }
  }, [navigation]);

  return (
    <Pressable
      onPress={goBack}
      style={[styles.root, webCursor, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      accessibilityLabel="Tap to return to app"
    >
      {/* ── Main Stage with Pure Cinematic Horizontal Reveal ── */}
      <View style={styles.stage} key={runKey}>
        <CinematicLogoLockup
          ref={lockupRef}
          play
          logoWidth={logoW}
          fontSize={24}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
});
