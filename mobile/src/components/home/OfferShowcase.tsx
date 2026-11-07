import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, fonts, space } from '../../theme';
import type { Offer } from '../../types/models';
import { Icon } from '../app/Icon';
import { OfferDeck } from './OfferDeck';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/**
 * Home's one offers card: the warm "limited offer" card, holding the hand of coupons. Kept light on words: a small tag
 * and count above, the code and one button below, both following the coupon on top as the hand shuffles (every few
 * seconds, or with a swipe). Tap a coupon or "Use code" to open that coupon on the Offers page.
 */
export function OfferShowcase({ offers, onOpen }: { offers: Offer[]; onOpen: (offerId: string) => void }) {
  const live = useMemo(() => offers.filter((o) => o.status !== 'expired'), [offers]);
  const [current, setCurrent] = useState<Offer | undefined>(live[0]);
  if (!live.length || !current) return null;

  const soon = current.status === 'upcoming';
  const at = Math.max(0, live.findIndex((o) => o.id === current.id));

  return (
    <View style={styles.card}>
      <View style={styles.deco} pointerEvents="none" />

      {/* one quiet row: the coupon's tag and where it sits in the hand; the coupon itself says the rest */}
      <View style={styles.headRow}>
        <Animated.View key={current.id} entering={FadeIn.duration(320)} style={styles.badge}>
          <View style={[styles.badgeDot, soon && { backgroundColor: colors.navy }]} />
          <Text style={styles.badgeText}>{(soon ? 'Coming soon' : (current.badgeLabel ?? 'Offer')).toUpperCase()}</Text>
        </Animated.View>
        <Text style={styles.count}>
          {at + 1} / {live.length}
        </Text>
      </View>

      <OfferDeck offers={offers} onOpen={onOpen} onTop={setCurrent} auto />

      <View style={styles.foot}>
        <Animated.View key={current.id} entering={FadeIn.duration(320)} style={styles.code}>
          <Icon name="tag" size={12} color={colors.ink} />
          <Text style={styles.codeText}>{current.code ?? current.id.toUpperCase()}</Text>
        </Animated.View>
        <Pressable
          onPress={() => onOpen(current.id)}
          accessibilityRole="button"
          accessibilityLabel={`${soon ? 'See' : 'Use'} ${current.title}`}
          style={({ pressed }) => [styles.cta, webCursor, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }]}
        >
          <Text style={styles.ctaText}>{soon ? 'See offer' : 'Use code'}</Text>
          <Icon name="arrowRight" size={13} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    backgroundColor: '#FFF7EE',
    borderWidth: 1.5,
    borderColor: '#FEE0C2',
    overflow: 'hidden',
    padding: space.lg,
    marginBottom: space.lg,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 12px rgba(254, 135, 1, 0.08), 0 1px 3px rgba(0,0,0,0.03)' } as object)
      : { shadowColor: '#FE8701', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 }),
  },
  deco: { position: 'absolute', right: -40, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(254, 135, 1, 0.08)' },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkMuted },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AD',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  badgeText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: '#D45D00' },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderColor: '#FED7AD',
    borderStyle: 'dashed',
  },
  codeText: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.8, color: colors.ink },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.ink },
  ctaText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
});
