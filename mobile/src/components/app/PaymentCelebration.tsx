import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  SlideInUp,
  SlideOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../../lib/haptics';
import { colors, fonts } from '../../theme';
import { Icon } from './Icon';

/**
 * Payment success moment, shown over everything: a toast drops in at the top ("Payment successful") and small
 * paper pieces in the logo colours burst out from under it and flutter down the screen. No pop-up, nothing to
 * dismiss, and touches pass straight through the confetti. Call `celebratePayment()` from anywhere once a payment
 * has gone through; `<PaymentCelebrationHost />` sits once at the app root.
 */
export type PaymentCelebrationInfo = {
  /** e.g. "₹349 paid" or "₹500 added" */
  amount: string;
  /** Toast title; defaults to "Payment successful". */
  title?: string;
  /** Kept for callers; the toast shows the title and amount only. */
  detail?: string;
  /** Toast text; defaults to the title. */
  toast?: string;
};

type Shown = PaymentCelebrationInfo & { id: number; ok: boolean; confetti?: boolean };
let listener: ((c: Shown) => void) | null = null;
let seq = 0;

export function celebratePayment(info: PaymentCelebrationInfo) {
  listener?.({ ...info, id: ++seq, ok: true });
}

/** In-app toast notification shown at the top over every screen and drawer. */
export function showToast(text: string) {
  listener?.({ amount: '', title: text, toast: text, id: ++seq, ok: true, confetti: false });
}

/** The same toast for a payment that didn't go through: red X, no confetti. `amount` can carry a short reason. */
export function paymentFailed(info: Partial<PaymentCelebrationInfo> = {}) {
  listener?.({ amount: '', title: 'Payment failed', ...info, id: ++seq, ok: false });
}

const GREEN = colors.success;
const RED = colors.danger;
/** Logo red, orange and blue, plus the brand navy: no neon. */
const CONFETTI = ['#D01028', '#F07D00', '#003F88', '#0A1C3E', '#F07D00', '#003F88'];
const PIECES = 70;
const BLAST_MS = 2800;
const TOAST_MS = 2800;

export function PaymentCelebrationHost() {
  const [blast, setBlast] = useState<Shown | null>(null);
  const [toast, setToast] = useState<Shown | null>(null);

  useEffect(() => {
    listener = (c) => {
      if (c.ok && c.confetti !== false) {
        haptic.success();
        setBlast(c);
      } else if (!c.ok) {
        haptic.error();
      } else {
        haptic.tap();
      }
      setToast(c);
    };
    return () => {
      listener = null;
    };
  }, []);

  // each one clears itself; a newer payment restarts the clocks
  useEffect(() => {
    if (!blast) return;
    const id = setTimeout(() => setBlast(null), BLAST_MS + 100);
    return () => clearTimeout(id);
  }, [blast]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.host]} pointerEvents="box-none">
      {blast ? <ConfettiBlast key={`blast-${blast.id}`} /> : null}
      {toast ? <TopToast key={`toast-${toast.id}`} info={toast} onClose={() => setToast(null)} /> : null}
    </View>
  );
}

function TopToast({ info, onClose }: { info: Shown; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const title = info.toast ?? info.title ?? (info.ok ? 'Payment successful' : 'Payment failed');
  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(180)}
      exiting={SlideOutUp.duration(260)}
      style={[styles.toastWrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={info.amount ? `${title}. ${info.amount}` : title}
        style={styles.toast}
      >
        <View style={[styles.toastTick, !info.ok && styles.toastCross]}>
          <Icon name={info.ok ? 'check' : 'x'} size={13} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={styles.toastText} numberOfLines={1}>
          {title}
          {info.amount ? <Text style={styles.toastAmount}>{`  ·  ${info.amount}`}</Text> : null}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Small paper pieces burst out from under the toast, then flutter down across the whole screen. */
function ConfettiBlast() {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withTiming(1, { duration: BLAST_MS, easing: Easing.linear });
  }, [reduced, t]);

  if (reduced) return null;
  return (
    <View style={[styles.confettiOrigin, { top: insets.top + 36, left: width / 2 }]} pointerEvents="none">
      {Array.from({ length: PIECES }, (_, i) => (
        <ConfettiPiece key={i} i={i} t={t} spread={width} drop={height} />
      ))}
    </View>
  );
}

/** One paper piece: shoots out sideways and up, then falls and tumbles down the screen. Fixed per index, so it never jumps on re-render. */
function ConfettiPiece({ i, t, spread, drop }: { i: number; t: SharedValue<number>; spread: number; drop: number }) {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const dx = (r(1) - 0.5) * spread * 1.1; // where it drifts to, left or right
  const up = 40 + r(2) * 90; // how high the burst throws it
  const fall = drop * (0.75 + r(3) * 0.35); // how far it falls
  const delay = r(8) * 0.12; // not every piece leaves at once
  const spin = (r(4) > 0.5 ? 1 : -1) * (540 + r(5) * 540);
  const sway = 8 + r(9) * 14;
  const w = 6 + r(6) * 5;
  const h = r(7) > 0.45 ? w * 0.5 : w;
  const color = CONFETTI[i % CONFETTI.length];

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (t.value - delay) / (1 - delay)));
    const burst = Math.min(1, p / 0.18);
    const out = 1 - (1 - burst) * (1 - burst); // fast out
    const after = Math.max(0, p - 0.18) / 0.82;
    return {
      opacity: p === 0 ? 0 : p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2,
      transform: [
        { translateX: dx * (0.35 * out + 0.65 * after) + Math.sin(after * 9 + i) * sway },
        { translateY: -up * out + fall * after * after },
        { rotate: `${spin * p}deg` },
        { scaleX: Math.cos(p * 12 + i) }, // the paper flips as it falls
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: w, height: h, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  host: {
    zIndex: 99999,
    elevation: 99999,
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100000,
    elevation: 100000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 18,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.06)',
    zIndex: 100001,
    elevation: 100001,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 28px rgba(10, 28, 62, 0.18)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 10001 }),
  },
  toastTick: { width: 24, height: 24, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  toastCross: { backgroundColor: RED },
  toastText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  toastAmount: { fontFamily: fonts.medium, color: colors.inkMuted },

  confettiOrigin: { position: 'absolute', width: 0, height: 0, zIndex: 99998, elevation: 99998 },
  piece: { position: 'absolute', borderRadius: 1.5 },
});
