import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors, fonts } from '../../theme';
import { EASE_OUT, RollingNumber } from '../app/motion';

const INK = '#2B2620';
const YELLOW = '#FEC837';
const SCALLOP = 14; // the receipt's torn bottom edge: little bites of the page colour

export type OrderCounts = { total: number; active: number; completed: number; cancelled: number; spent: number };
type Stat = 'active' | 'completed' | 'cancelled';

const STATS: { key: Stat; label: string; color: string }[] = [
  { key: 'active', label: 'Active', color: colors.orange },
  { key: 'completed', label: 'Delivered', color: '#1F9D3A' },
  { key: 'cancelled', label: 'Cancelled', color: '#9A9286' },
];

/**
 * The Orders page's summary, drawn as a yellow receipt printing out of a dark slot: it slides down out of the slot each
 * time the page opens, the amount rolls up, and the bar under it fills in. Its bottom edge is torn like a till receipt.
 * Tap a count to show just those orders.
 */
export function OrdersSummary({
  counts,
  since,
  replay,
  canvas,
  onStat,
}: {
  counts: OrderCounts;
  /** e.g. "Since Oct 2025"; optional. */
  since?: string;
  replay: number;
  /** The page colour, for the torn edge. */
  canvas: string;
  onStat: (s: Stat) => void;
}) {
  const reduced = useReducedMotion();
  const [h, setH] = useState(0);
  const print = useSharedValue(reduced ? 1 : 0);
  const fill = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    print.value = 0;
    fill.value = 0;
    print.value = withDelay(80, withTiming(1, { duration: 900, easing: EASE_OUT }));
    fill.value = withDelay(650, withTiming(1, { duration: 800, easing: EASE_OUT }));
  }, [replay, reduced, print, fill]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -(1 - print.value) * (h || 260) }] }));
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  const parts = counts.active + counts.completed + counts.cancelled;
  const [width, setWidth] = useState(0);

  return (
    <View>
      {/* the printer slot the receipt comes out of */}
      <View style={styles.slot}>
        <View style={styles.slotLip} />
      </View>

      <View style={styles.clip}>
        <Animated.View style={slide} onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))}>
          <View style={styles.receipt}>
            <View style={styles.head}>
              <Text style={styles.kicker}>ORDER SUMMARY</Text>
              {since ? <Text style={styles.since}>{since}</Text> : null}
            </View>

            <View style={styles.main}>
              <View style={{ flex: 1 }}>
                <RollingNumber value={counts.spent} style={styles.amount} delay={380} />
                <Text style={styles.amountLabel}>Total spent</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.count}>{counts.total}</Text>
                <Text style={styles.countLabel}>{counts.total === 1 ? 'order' : 'orders'}</Text>
              </View>
            </View>

            {/* the split, as one bar that fills in from the left */}
            <View style={styles.bar} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              <Animated.View style={[styles.barFill, { width }, grow, { transformOrigin: 'left' }]}>
                {parts
                  ? STATS.map((s) => (counts[s.key] ? <View key={s.key} style={{ flex: counts[s.key], backgroundColor: s.color }} /> : null))
                  : null}
              </Animated.View>
            </View>

            <View style={styles.rule} />

            <View style={styles.stats}>
              {STATS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => onStat(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${counts[s.key]} ${s.label} orders`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.stat, Platform.OS === 'web' && ({ cursor: 'pointer' } as object), pressed && { opacity: 0.6 }]}
                >
                  <View style={styles.statTop}>
                    <View style={[styles.statDot, { backgroundColor: s.color }]} />
                    <Text style={styles.statValue}>{counts[s.key]}</Text>
                  </View>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* the torn edge */}
          <View style={styles.edge} pointerEvents="none">
            {Array.from({ length: Math.max(12, Math.floor((width + 48) / (SCALLOP + 4))) }, (_, i) => (
              <View key={i} style={[styles.bite, { backgroundColor: canvas }]} />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: 16, borderRadius: 8, backgroundColor: INK, marginHorizontal: -4, justifyContent: 'flex-end', zIndex: 2 },
  slotLip: { height: 4, marginHorizontal: 10, borderRadius: 2, backgroundColor: '#14110D', marginBottom: 3 },
  clip: { overflow: 'hidden', marginTop: -8, paddingHorizontal: 6 },

  receipt: { backgroundColor: YELLOW, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: INK },
  since: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(43,38,32,0.66)' },

  main: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  amount: { fontFamily: fonts.extrabold, fontSize: 38, lineHeight: 44, letterSpacing: -1.4, color: INK },
  amountLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(43,38,32,0.7)', marginTop: 1 },
  countBox: { alignItems: 'center', justifyContent: 'center', width: 74, height: 74, borderRadius: 22, backgroundColor: INK },
  count: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: -1, color: YELLOW },
  countLabel: { fontFamily: fonts.semibold, fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(43,38,32,0.12)', overflow: 'hidden', marginTop: 16 },
  barFill: { height: 8, flexDirection: 'row', gap: 3 },
  rule: { marginTop: 16, borderTopWidth: 1.5, borderColor: 'rgba(43,38,32,0.28)', borderStyle: 'dashed' },

  stats: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statValue: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: INK, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(43,38,32,0.7)', marginTop: 1 },

  edge: { flexDirection: 'row', justifyContent: 'space-around', overflow: 'hidden', height: SCALLOP / 2, backgroundColor: YELLOW },
  bite: { width: SCALLOP, height: SCALLOP, borderRadius: SCALLOP / 2, marginTop: 0, transform: [{ translateY: SCALLOP / 2 - 1 }] },
});
