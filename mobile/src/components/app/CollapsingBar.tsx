import React, { useState } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const TURN = 14; // how far the page must move one way before the bar follows
const GLIDE = { duration: 280, easing: Easing.out(Easing.cubic) };

/**
 * Hide-on-scroll for a page's top bar: reading on (scrolling down) slides the bar up out of the way, the slightest
 * scroll back brings it straight down again, and near the top it always shows. Pass `onScroll` to the page's
 * Animated.ScrollView (with scrollEventThrottle={16}) and pad its content by `height`.
 */
export function useCollapsingBar() {
  const scrollY = useSharedValue(0);
  const hidden = useSharedValue(0); // 0 shown → 1 tucked away, animated
  const want = useSharedValue(0);
  const last = useSharedValue(0);
  const travel = useSharedValue(0); // distance moved in the current direction
  const barH = useSharedValue(0);
  const [height, setHeight] = useState(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    const dy = y - last.get();
    last.set(y);
    scrollY.set(y);
    const t = travel.get();
    travel.set(dy !== 0 && Math.sign(dy) === Math.sign(t) ? t + dy : dy);
    let next = want.get();
    if (y <= barH.get()) next = 0;
    else if (travel.get() > TURN) next = 1;
    else if (travel.get() < -TURN) next = 0;
    if (next !== want.get()) {
      want.set(next);
      hidden.set(withTiming(next, GLIDE));
    }
  });

  const measure = (h: number) => {
    barH.set(h);
    setHeight(h);
  };

  return { onScroll, scrollY, hidden, barH, height, measure };
}

export type CollapsingBarState = ReturnType<typeof useCollapsingBar>;

/**
 * The bar itself, laid over the top of the page. At rest it's clear and sits on the page's own colour; once the page
 * moves under it, frosted glass in `tint` fades in behind it so the content blurs softly through.
 */
export function CollapsingBar({
  bar,
  tint = '250, 249, 246',
  style,
  children,
}: {
  bar: CollapsingBarState;
  /** The page's background as "r, g, b", for the glass. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { hidden, barH, scrollY, measure } = bar;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.get() * (barH.get() + 6) }] }));
  const frost = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [0, 16], [0, 1], 'clamp') }));

  const solidBg = tint.includes(',') ? `rgb(${tint})` : tint;

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: solidBg }, slide, style]}
      onLayout={(e) => measure(Math.round(e.nativeEvent.layout.height))}
    >
      <Animated.View pointerEvents="none" style={[styles.glass, glassFor(tint), frost]} />
      {children}
    </Animated.View>
  );
}

const glassFor = (_tint: string) =>
  Platform.OS === 'web'
    ? ({
        boxShadow: '0 4px 16px -4px rgba(40, 30, 10, 0.08)',
      } as object)
    : {
        shadowColor: '#0A1C3E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      };

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  glass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10, 28, 62, 0.08)',
  },
});
