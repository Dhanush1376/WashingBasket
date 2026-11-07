import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Icon, type IconName } from '../app/Icon';
import { app, colors, fonts, space } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/** One colour per card, from the logo: navy, yellow, charcoal, orange, then a soft cream for the open card. */
const LOOKS = [
  { bg: '#54B6F8', fg: '#0A1C3E', soft: 'rgba(10,28,62,0.72)' }, // soft brand blue
  { bg: '#FED843', fg: '#0A1C3E', soft: 'rgba(10,28,62,0.72)' }, // soft warm gold
  { bg: '#FFA742', fg: '#0A1C3E', soft: 'rgba(10,28,62,0.72)' }, // soft brand orange
  { bg: '#62D487', fg: '#0A1C3E', soft: 'rgba(10,28,62,0.72)' }, // soft fresh green
  { bg: '#DE73F0', fg: '#0A1C3E', soft: 'rgba(10,28,62,0.72)' }, // soft lilac
] as const;

/*
 * The scroll-stack recipe (after React Bits' ScrollStack), rebuilt for React Native so it runs on phones and web:
 * cards sit apart, each pins near the top as you scroll, the next one slides over it, and every card underneath
 * shrinks a little and darkens a little for each card stacked on top of it.
 */
const CARD_H = 236; // every card is the same size, with the same three parts
const ITEM_DISTANCE = 64; // the gap between cards before they stack
const STACK_DISTANCE = 26; // how far each card rests below the one before it, once stacked
const STACK_POSITION = 0.14; // where the stack pins, as a share of the screen height
const ITEM_SCALE = 0.05; // how much a card shrinks per card stacked on top of it
const BASE_SCALE = 0.8; // the smallest a buried card shrinks to
const DIM_AMOUNT = 0.2; // how much a card darkens per card stacked on top of it

export type ExploreItem = {
  key: string;
  title: string;
  icon: IconName;
  /** The big line: the most useful thing about that page right now. */
  headline: string;
  /** One quiet line under it. */
  detail: string;
  onPress: () => void;
};

export function ExploreStack({
  items,
  scrollY,
  bottomInset,
  pinTop,
}: {
  items: ExploreItem[];
  scrollY: SharedValue<number>;
  bottomInset: number;
  /** The safe-area top: the stack pins a little below it. */
  pinTop: number;
}) {
  const { height: screenH } = useWindowDimensions();
  // where the cards start on the page, read live by the scroll animation
  const sectionY = useSharedValue(0);
  const listY = useSharedValue(0);
  const list = items.slice(0, LOOKS.length);
  if (!list.length) return null;

  const stackTop = pinTop + Math.round(screenH * STACK_POSITION);
  // the open card fills everything below the stack, down to the bottom edge, so the page ends exactly when the
  // last card lands
  const lastH = Math.max(CARD_H + bottomInset, screenH - stackTop - (list.length - 1) * STACK_DISTANCE);

  return (
    <View style={styles.wrap} onLayout={(e) => sectionY.set(e.nativeEvent.layout.y)}>
      <Text style={styles.title} accessibilityRole="header">
        Explore{'\n'}more
      </Text>
      <View onLayout={(e) => listY.set(e.nativeEvent.layout.y)}>
        {list.map((item, i) => (
          <StackCard
            key={item.key}
            item={item}
            index={i}
            count={list.length}
            lastH={lastH}
            bottomInset={bottomInset}
            stackTop={stackTop}
            sectionY={sectionY}
            listY={listY}
            scrollY={scrollY}
          />
        ))}
      </View>
    </View>
  );
}

function StackCard({
  item,
  index,
  count,
  lastH,
  bottomInset,
  stackTop,
  sectionY,
  listY,
  scrollY,
}: {
  item: ExploreItem;
  index: number;
  count: number;
  lastH: number;
  bottomInset: number;
  stackTop: number;
  sectionY: SharedValue<number>;
  listY: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const look = LOOKS[index];
  const last = index === count - 1;
  const pin = stackTop + index * STACK_DISTANCE; // where this card holds on screen
  const pitch = CARD_H + ITEM_DISTANCE; // distance from one card's top to the next, before stacking

  // pinning: on the web the browser does it (sticky), so it moves in lockstep with the scroll; on phones it runs on
  // the UI thread
  const hold = useAnimatedStyle(() => {
    if (Platform.OS === 'web') return {};
    const y = sectionY.value + listY.value + index * pitch;
    const maxHold = (count - 1 - index) * (pitch - STACK_DISTANCE);
    return { transform: [{ translateY: Math.min(maxHold, Math.max(0, scrollY.value + pin - y)) }] };
  });

  // depth: how many cards lie on top of this one (fractions while one is sliding over), driving shrink and dim
  const depthOf = (scroll: number, base: number) => {
    'worklet';
    let depth = 0;
    for (let j = index + 1; j < count; j++) {
      const top = base + j * pitch - scroll; // where card j would be on screen, unpinned
      const prevPin = stackTop + (j - 1) * STACK_DISTANCE;
      const cover = Math.min(1, Math.max(0, (prevPin + CARD_H - top) / Math.max(1, CARD_H - STACK_DISTANCE)));
      depth += cover;
    }
    return depth;
  };
  const shrink = useAnimatedStyle(() => {
    const depth = depthOf(scrollY.value, sectionY.value + listY.value);
    return { transform: [{ scale: Math.max(BASE_SCALE, 1 - depth * ITEM_SCALE) }] };
  });
  const shade = useAnimatedStyle(() => {
    const depth = depthOf(scrollY.value, sectionY.value + listY.value);
    return { opacity: 1 - Math.pow(1 - DIM_AMOUNT, depth) };
  });

  return (
    <Animated.View
      style={[
        { zIndex: index + 1, marginTop: index ? ITEM_DISTANCE : 0 },
        Platform.OS === 'web' ? ({ position: 'sticky', top: pin } as object) : null,
        hold,
      ]}
    >
      <Animated.View style={[styles.scaler, shrink]}>
        <Pressable
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.headline}. ${item.detail}`}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: look.bg, height: last ? lastH : CARD_H },
            last && { paddingBottom: bottomInset + space.lg },
            webCursor,
            pressed && { opacity: 0.97 },
          ]}
        >
          <View style={styles.row}>
            <View style={styles.badge}>
              <Icon name={item.icon} size={19} color={colors.ink} strokeWidth={2.1} />
            </View>
            <Text style={[styles.name, { color: look.fg }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.arrow}>
              <Icon name="arrowUpRight" size={17} color={colors.ink} strokeWidth={2.2} />
            </View>
          </View>
          <Text style={[styles.headline, { color: look.fg }]} numberOfLines={2}>
            {item.headline}
          </Text>
          <Text style={[styles.detail, { color: look.soft }]} numberOfLines={1}>
            {item.detail}
          </Text>
          {/* darkens as cards stack on top */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color: colors.ink,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  // shrinks from its top edge, so a buried card recedes into the pile instead of sliding out from under it
  scaler: { transformOrigin: ['50%', 0, 0] },
  // edge to edge, rounded only on top: the stack runs off the bottom of the screen
  card: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: space.lg,
    paddingTop: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -12px 32px -14px rgba(0, 0, 0, 0.35)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10 }),
  },
  shade: { backgroundColor: '#000000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 46 },
  badge: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.2 },
  arrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headline: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, marginTop: space.lg, height: 58 },
  detail: { fontFamily: fonts.medium, fontSize: 13, marginTop: space.sm },
});
