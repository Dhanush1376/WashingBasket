import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ART, ART_TINT } from '../../components/app/art';
import { Icon, type IconName } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { TopBar } from '../../components/app/TopBar';
import { ErrorState, Skeleton } from '../../components/app/states';
import { FloatingBottomBar } from '../../components/navigation/FloatingBottomBar';
import { haptic } from '../../lib/haptics';
import { keys, useQuery } from '../../lib/query';
import { useWebDrag } from '../../lib/useWebDrag';
import type { ScreenProps } from '../../navigation/types';
import { getPriceMenu, type MenuSection } from '../../services/mock/pricing.service';
import { app, colors, fonts, space } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

const BG = '#FAF9F6';
const INK = '#0A1C3E';
const PAGE = space.lg;
const SHEET_ID = 'pricelist-drawer-sheet';
const UNIT: Record<MenuSection['unit'], string> = { kg: 'kg', pair: 'pair', pc: 'pc' };
const UNIT_LONG: Record<MenuSection['unit'], string> = { kg: 'per kg', pair: 'per pair', pc: 'per piece' };

/** Each section of the menu gets its own colour, background tint, and icon, taken from the app's palette. */
const LOOK: Record<string, { color: string; tint: string; icon: IconName }> = {
  'only-wash': { color: '#FFA742', tint: '#FFF5E8', icon: 'droplet' },
  'wash-iron': { color: '#54B6F8', tint: '#EBF6FE', icon: 'shirt' },
  'shoes-bags': { color: '#F87C87', tint: '#FEF0F2', icon: 'bag' },
  stain: { color: '#62D487', tint: '#EBF9F0', icon: 'spray' },
  dye: { color: '#FED843', tint: '#FFFBEA', icon: 'star' },
  'dry-clean': { color: INK, tint: '#F0ECE4', icon: 'shield' },
  blanket: { color: '#54B6F8', tint: '#EBF6FE', icon: 'package' },
};
const lookOf = (id: string) => LOOK[id] ?? { color: INK, tint: '#F0ECE4', icon: 'list' as IconName };

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 2px 4px rgba(10, 28, 62, 0.04), 0 8px 24px rgba(10, 28, 62, 0.08)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 };

/**
 * The price list as an interactive app drawer / bottom sheet:
 * Top stage displays the brand hero card and jump-link pills.
 * The sliding sheet holds all the category price cards and the good-to-know note.
 */
export function PriceListScreen({ navigation }: ScreenProps<'PriceList'>) {
  const insets = useSafeAreaInsets();
  const menu = useQuery(keys.priceMenu, getPriceMenu);
  const scroll = useRef<any>(null);
  const listY = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const [heroH, setHeroH] = useState(0);

  const sections = menu.data?.sections ?? [];
  const lowest = sections.find((s) => s.unit === 'kg')?.items.reduce((m, i) => Math.min(m, i.price), Infinity);

  // The sliding drawer sheet: drag or tap handle to rise over the hero stage
  const sheetTop = heroH ? heroH + 10 : 0;
  const lift = Math.round(Math.max(0, sheetTop - insets.top - 60));
  const pos = useSharedValue(0); // 0 = resting, 1 = raised
  const startPos = useSharedValue(0);
  const [isRaised, setIsRaised] = useState(false);

  const settle = (to: number) => {
    setIsRaised(to > 0.5);
    pos.set(withSpring(to, { damping: 22, stiffness: 240, mass: 0.8 }));
  };

  const toggle = () => {
    haptic.tap();
    settle(pos.value > 0.5 ? 0 : 1);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          startPos.set(pos.value);
        },
        onPanResponderMove: (_, g) => {
          const p = startPos.value - g.dy / Math.max(lift, 1);
          pos.set(p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p);
        },
        onPanResponderRelease: (_, g) =>
          settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.value > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos]
  );

  useWebDrag(
    'pricelist-handle',
    {
      onStart: () => startPos.set(pos.value),
      onMove: (dy) => {
        const v = startPos.value - dy / Math.max(lift, 1);
        pos.set(v < 0 ? v * 0.25 : v > 1 ? 1 + (v - 1) * 0.25 : v);
      },
      onEnd: (vy) => settle(vy < -0.3 ? 1 : vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
    },
    [heroH, lift]
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pos.value * lift }],
  }));

  const listInset = useAnimatedStyle(() => ({
    marginBottom: (1 - Math.min(1, Math.max(0, pos.value))) * lift,
  }));

  const heroStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: 1 - t * 0.2, transform: [{ scale: 1 - t * 0.04 }] };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: t * 0.52 };
  });

  const onListScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    listY.current = e.nativeEvent.contentOffset.y;
  };

  const onListDragEnd = (e: { nativeEvent: { contentOffset: { y: number }; velocity?: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y <= 0 && pos.value > 0.5 && (e.nativeEvent.velocity?.y ?? 0) < -0.2) {
      settle(0);
    }
  };

  const onListDragBegin = () => {
    if (pos.value < 0.5) settle(1);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = document.getElementById(SHEET_ID);
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return;
      const raised = pos.value > 0.5;
      if (e.deltaY > 0 && !raised) {
        e.preventDefault();
        settle(1);
      } else if (e.deltaY < 0 && raised && listY.current <= 0) {
        e.preventDefault();
        settle(0);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);

  }, [heroH, lift]);

  return (
    <View style={styles.root}>
      {/* ── Top stage: TopBar & Hero card ── */}
      <Animated.View
        style={[styles.stage, { paddingTop: Math.max(insets.top, 6) }, heroStyle]}
        onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}
      >
        <View style={styles.stageInner}>
          <Rise distance={8}>
            <TopBar padded={false} title="Price list" leading="logo" />
          </Rise>

          <Rise distance={10}>
            <View style={styles.hero}>
              <View style={[styles.heroArt, { backgroundColor: ART_TINT.washing }]}>
                <Image source={ART.washing} style={styles.heroImg} resizeMode="cover" accessibilityIgnoresInvertColors />
              </View>
              <View style={styles.heroText}>
                <View style={styles.kicker}>
                  <View style={styles.kickerDot} />
                  <Text style={styles.kickerText}>Our prices</Text>
                </View>
                <Text style={styles.heroTitle}>Honest prices,{'\n'}no surprises</Text>
                {Number.isFinite(lowest) ? (
                  <View style={styles.fromChip}>
                    <Text style={styles.fromText}>
                      From <Text style={styles.fromStrong}>₹{lowest}</Text> / kg
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Rise>
        </View>
      </Animated.View>

      {/* Dimming backdrop behind the sheet when raised */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={isRaised ? 'auto' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => settle(0)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss price list"
        />
      </Animated.View>

      {/* ── Interactive sliding bottom sheet (App Drawer style like Wallet & Offers) ── */}
      {heroH ? (
        <Animated.View
          nativeID={SHEET_ID}
          style={[styles.sheet, { top: sheetTop, bottom: -lift }, sheetStyle]}
          {...pan.panHandlers}
        >
          <View style={styles.sheetInner}>
            {/* Drag Handle */}
            <Pressable
              id="pricelist-handle"
              nativeID="pricelist-handle"
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel="Show more or fewer prices"
              hitSlop={10}
              style={[styles.handleHit, webCursor]}
            >
              <View style={styles.handle} />
            </Pressable>

            {/* Sheet Header */}
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>All services</Text>
              <Text style={styles.sheetCount}>{sections.length} categories</Text>
            </View>

            {/* Scrolling services inside sheet */}
            <Animated.View style={[{ flex: 1 }, listInset]}>
              <ScrollView
                ref={scroll}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: PAGE,
                  paddingBottom: Math.max(insets.bottom, 12) + 160,
                }}
                showsVerticalScrollIndicator={false}
                onScroll={onListScroll}
                onScrollBeginDrag={onListDragBegin}
                onScrollEndDrag={onListDragEnd}
                scrollEventThrottle={16}
              >
                {menu.loading ? (
                  <View style={{ gap: space.md, marginTop: space.sm }}>
                    <Skeleton height={190} radius={24} />
                    <Skeleton height={190} radius={24} />
                  </View>
                ) : menu.error || !menu.data ? (
                  <ErrorState onRetry={menu.refetch} />
                ) : (
                  <View style={styles.list}>
                    {sections.map((s, i) => (
                      <View
                        key={s.id}
                        onLayout={(e) => (sectionY.current[s.id] = e.nativeEvent.layout.y)}
                      >
                        <Section section={s} index={i} />
                      </View>
                    ))}

                    {/* the small print, kept friendly */}
                    <View style={[styles.note, soft]}>
                      <View style={styles.noteIcon}>
                        <Icon name="info" size={17} color={colors.orange} strokeWidth={2.2} />
                      </View>
                      <View style={styles.noteBody}>
                        <Text style={styles.noteKicker}>Please note</Text>
                        <Text style={styles.noteText}>{menu.data.note}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      {/* Floating "Book a pickup" CTA fixed right above FloatingBottomBar */}
      <View
        pointerEvents="box-none"
        style={[
          styles.ctaDock,
          {
            bottom: Math.max(insets.bottom, 12) + 64,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            haptic.tap();
            navigation.navigate('Main', { screen: 'Book' });
          }}
          accessibilityRole="button"
          accessibilityLabel="Book a pickup"
          style={({ pressed }) => [
            styles.cta,
            webCursor,
            pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
          ]}
        >
          <Text style={styles.ctaText}>Book a pickup</Text>
          <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Floating Bottom Navigation Bar */}
      <FloatingBottomBar />
    </View>
  );
}

/** One section of the menu: a coloured ribbon with its name, then each item with a dotted leader to its price. */
function Section({ section, index }: { section: MenuSection; index: number }) {
  const look = lookOf(section.id);
  const two = Boolean(section.columns?.length);
  return (
    <View style={[styles.card, soft]}>
      <View style={styles.cardHead}>
        <View style={[styles.ribbon, { backgroundColor: look.color }]}>
          <Icon name={look.icon} size={14} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.ribbonText} numberOfLines={1}>
            {section.title}
          </Text>
        </View>
        <Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text>
      </View>

      {/* the unit, or the Single / Double columns for blankets */}
      <View style={styles.colHead}>
        <Text style={styles.colHeadText}>{UNIT_LONG[section.unit]}</Text>
        {two ? (
          <View style={styles.cols}>
            {section.columns!.map((c) => (
              <Text key={c} style={[styles.colHeadText, styles.colCell]}>
                {c}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {section.items.map((it, i) => (
        <View key={it.name} style={[styles.item, i > 0 && styles.itemRule]}>
          <Text style={styles.itemName}>{it.name}</Text>
          <View style={styles.leader} />
          {two ? (
            <View style={styles.cols}>
              <Price value={it.price} />
              <Price value={it.price2} />
            </View>
          ) : (
            <Text style={styles.price}>
              ₹{it.price}
              <Text style={styles.per}> /{UNIT[section.unit]}</Text>
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Price({ value }: { value?: number }) {
  return <Text style={[styles.price, styles.colCell]}>{value === undefined ? '—' : `₹${value}`}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  stage: { backgroundColor: BG },
  stageInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 6 },

  hero: { height: 176, borderRadius: 28, backgroundColor: INK, overflow: 'hidden', marginTop: space.xs },
  heroArt: { position: 'absolute', right: -46, top: -10, width: 196, height: 196, borderRadius: 98, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroText: { flex: 1, padding: 18, justifyContent: 'space-between', maxWidth: '64%' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: app.yellow },
  kickerText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#FFFFFF' },
  heroTitle: { fontFamily: fonts.bold, fontSize: 23, lineHeight: 27, letterSpacing: -0.7, color: '#FFFFFF' },
  fromChip: { alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: app.yellow, justifyContent: 'center' },
  fromText: { fontFamily: fonts.medium, fontSize: 12.5, color: INK },
  fromStrong: { fontFamily: fonts.bold },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DA',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -8px 32px rgba(40, 30, 10, 0.12)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 }),
  },
  sheetInner: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  handleHit: {
    alignSelf: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },

  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: INK },
  sheetCount: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
    backgroundColor: '#F4F2EE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  backdrop: { backgroundColor: '#000000' },

  list: { gap: space.md, marginTop: space.sm },
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1.25, borderColor: '#DDD7CA', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 30, paddingLeft: 12, paddingRight: 14, borderRadius: 15, flexShrink: 1 },
  ribbonText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', color: '#FFFFFF', flexShrink: 1 },
  index: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: '#CFC8BA', fontVariant: ['tabular-nums'] },

  colHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 2 },
  colHeadText: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  cols: { flexDirection: 'row' },
  colCell: { width: 62, textAlign: 'right' },

  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  itemRule: { borderTopWidth: 1, borderTopColor: '#F4F1EB' },
  itemName: { fontFamily: fonts.medium, fontSize: 14.5, letterSpacing: -0.2, color: INK, flexShrink: 1 },
  leader: { flex: 1, minWidth: 16, marginHorizontal: 10, marginTop: 6, borderBottomWidth: 1.5, borderColor: '#DDD6C8', borderStyle: 'dotted' },
  price: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2, color: INK, fontVariant: ['tabular-nums'] },
  per: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderColor: '#DDD7CA',
  },
  noteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF1E0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noteBody: { flex: 1 },
  noteKicker: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.orange,
    marginBottom: 2,
  },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: INK },

  ctaDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: PAGE,
    alignItems: 'center',
    zIndex: 98,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
    backgroundColor: INK,
    width: '100%',
    maxWidth: 500,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(10, 28, 62, 0.22), 0 2px 6px rgba(10, 28, 62, 0.12)' } as object)
      : { shadowColor: INK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 8 }),
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 15.5, color: '#FFFFFF' },
});
