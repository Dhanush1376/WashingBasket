import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '../../lib/haptics';
import { colors, fonts } from '../../theme';

const INK = colors.ink;

/**
 * A little receipt printer: the slip feeds out of the slot line by line, with light haptic ticks while it prints.
 * `onPrinted` runs once the whole slip is out.
 */
export function SlipPrinter({ children, onPrinted }: { children: React.ReactNode; onPrinted?: () => void }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const [done, setDone] = useState(false);
  const progress = useSharedValue(0);
  const started = useRef(false);
  const finish = useEffectEvent(() => {
    setDone(true);
    haptic.success();
    onPrinted?.();
  });

  useEffect(() => {
    if (!height || started.current) return;
    started.current = true;
    const duration = reduced ? 0 : Math.min(3400, 1000 + height * 1.7);
    progress.value = withTiming(1, { duration, easing: Easing.bezier(0.25, 0.1, 0.35, 1) }, (fin) => {
      if (fin) scheduleOnRN(finish);
    });
    if (reduced) return;
    // the print head's rhythm
    const tick = setInterval(() => haptic.tap(), 200);
    const stop = setTimeout(() => clearInterval(tick), duration - 150);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [height, reduced, progress]);

  const feed = useAnimatedStyle(() => ({ transform: [{ translateY: (progress.value - 1) * height }] }));

  return (
    <View>
      <View style={styles.printer} accessibilityLabel={done ? 'Slip printed' : 'Printing your slip'}>
        <View style={styles.printerTop}>
          <View style={[styles.led, done && styles.ledDone]} />
          <Text style={styles.printerText}>{done ? 'PRINTED' : 'PRINTING…'}</Text>
        </View>
        <View style={styles.slot} />
      </View>
      {/* the paper comes out from under the slot; anything still "inside" the printer is clipped */}
      <View style={styles.clip}>
        <Animated.View
          style={[styles.paper, feed, !height && styles.hidden]}
          onLayout={(e) => {
            if (!height) setHeight(e.nativeEvent.layout.height);
          }}
        >
          {children}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  printer: {
    height: 44,
    borderRadius: 14,
    backgroundColor: INK,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    paddingTop: 7,
    paddingBottom: 9,
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 16px rgba(10, 28, 62, 0.22)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6 }),
  },
  printerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  led: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  ledDone: { backgroundColor: colors.success },
  printerText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2, color: 'rgba(255, 255, 255, 0.8)' },
  slot: { height: 5, borderRadius: 2.5, backgroundColor: '#020B1C', marginHorizontal: 4 },
  clip: { overflow: 'hidden', marginTop: -7, paddingHorizontal: 10, paddingBottom: 12 },
  paper: {},
  hidden: { opacity: 0 },
});
