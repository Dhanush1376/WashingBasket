import { BlurView } from 'expo-blur';
import QRCode from 'qrcode';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, fonts } from '../../theme';
import { Icon } from '../app/Icon';

const QUIET = 2;

/** A real, scannable QR code drawn with SVG (works on phones and the web). */
export function QrCode({
  value,
  size = 220,
  color = colors.ink,
  bg = '#FFFFFF',
}: {
  value: string;
  size?: number;
  color?: string;
  bg?: string;
}) {
  const { d, n } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) if (qr.modules.get(r, c)) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    }
    return { d: path, n: count + QUIET * 2 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR code">
      {bg !== 'transparent' ? <Rect x={0} y={0} width={n} height={n} fill={bg} /> : null}
      <Path d={d} fill={color} {...(Platform.OS === 'web' ? ({ shapeRendering: 'crispEdges' } as object) : {})} />
    </Svg>
  );
}

/**
 * The order's QR in a frame. While `locked`, a decoy pattern (never the real token) sits under a blur with a lock,
 * so nothing scannable is on screen before payment. Unlocking clears the blur and settles the real code in.
 */
export function QrFrame({ value, locked, size = 220, label }: { value: string; locked: boolean; size?: number; label?: string }) {
  const reduced = useReducedMotion();
  const veil = useSharedValue(locked ? 1 : 0);
  const pop = useSharedValue(1);
  const wasLocked = useRef(locked);
  // the veil stays mounted only while locked or fading out, so nothing of it lingers once the code is open
  const [veilShown, setVeilShown] = useState(locked);
  if (locked && !veilShown) setVeilShown(true);

  useEffect(() => {
    if (wasLocked.current && !locked) {
      veil.value = withTiming(0, { duration: reduced ? 0 : 700, easing: Easing.out(Easing.cubic) }, (fin) => {
        if (fin) scheduleOnRN(setVeilShown, false);
      });
      pop.value = reduced ? 1 : withSequence(withTiming(0.94, { duration: 160 }), withDelay(120, withSpring(1, { damping: 11, stiffness: 160 })));
    } else veil.value = locked ? 1 : 0;
    wasLocked.current = locked;
  }, [locked, veil, pop, reduced]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const codeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  // a stable decoy per order, so the locked pattern doesn't flicker on every render
  const decoy = useMemo(() => `WASHING-BASKET-LOCKED-${value.length}-${value.slice(-3).split('').reverse().join('')}`, [value]);

  return (
    <View style={[styles.frame, { width: size + 28, height: size + 28 }]} accessible accessibilityLabel={label ?? (locked ? 'QR code, locked until payment' : 'QR code')}>
      <Animated.View style={codeStyle}>
        <QrCode value={locked ? decoy : value} size={size} color={locked ? '#E2E8F0' : colors.ink} />
      </Animated.View>
      {veilShown ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} pointerEvents="none">
          <BlurView intensity={Platform.OS === 'web' ? 18 : 45} tint="light" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.veilWash]} />
          <View style={styles.lockContainer}>
            <View style={styles.lock}>
              <Icon name="lock" size={24} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.lockPill}>
              <Text style={styles.lockPillText}>LOCKED</Text>
            </View>
          </View>
        </Animated.View>
      ) : null}
      {/* corner marks, like a scanner frame */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <View key={c} style={[styles.corner, styles[c]]} pointerEvents="none" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  veil: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(7px)',
          WebkitBackdropFilter: 'blur(7px)',
        } as object)
      : {}),
  },
  veilWash: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.70)' : 'rgba(255, 255, 255, 0.94)',
  },
  lockContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 5,
  },
  lock: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(10, 28, 62, 0.22)' } as object)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        }),
  },
  lockPill: {
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 12,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.18)' } as object)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 4,
        }),
  },
  lockPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: colors.orange,
  },
  tl: {
    top: 6,
    left: 6,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  tr: {
    top: 6,
    right: 6,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bl: {
    bottom: 6,
    left: 6,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  br: {
    bottom: 6,
    right: 6,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
});
