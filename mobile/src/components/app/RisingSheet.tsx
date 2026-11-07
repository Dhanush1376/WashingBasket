import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../../lib/haptics';
import { useWebDrag } from '../../lib/useWebDrag';
import { space } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const SPRING = { damping: 22, stiffness: 240, mass: 0.8 };

/**
 * The Wallet page's scrolling, reusable: the top bar and the card stay put at the top, and a white sheet sits below
 * them. Scroll (wheel, trackpad or finger) or drag its handle and the whole sheet rises up over the card, which dims
 * and settles back a little; then the sheet's own content scrolls. Scroll back to the top of the sheet and keep going,
 * or tap the dimmed card, and it lowers again.
 */
export function RisingSheet({
  id,
  hero,
  head,
  children,
  contentBottom = 0,
  heroStyle,
  dim = '#0A1C3E',
}: {
  /** Unique per page: lets the web listeners find the sheet. */
  id: string;
  /** What stays at the top: the top bar and the card. */
  hero: React.ReactNode;
  /** Under the handle, also a drag area: the sheet's title row. */
  head?: React.ReactNode;
  /** The sheet's scrolling content. */
  children: React.ReactNode;
  /** Room at the end of the content, e.g. to clear a floating bar. */
  contentBottom?: number;
  heroStyle?: StyleProp<ViewStyle>;
  /** Colour the card dims towards as the sheet rises. */
  dim?: string;
}) {
  const insets = useSafeAreaInsets();
  const [heroH, setHeroH] = useState(0);
  const handleId = `${id}-handle`;

  // how far the sheet rises: most of the way over the card, stopping a little under the top bar
  const lift = Math.round(Math.max(0, heroH - Math.max(insets.top, 6) - 64) * 0.85);
  const pos = useSharedValue(0); // 0 resting, 1 raised
  const startPos = useSharedValue(0);
  const [raised, setRaised] = useState(false);
  const listY = useRef(0);

  const settle = (to: number) => {
    setRaised(to > 0.5);
    pos.set(withSpring(to, SPRING));
  };
  const follow = (p: number) => pos.set(p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p); // a little give past either end

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => startPos.set(pos.get()),
        onPanResponderMove: (_, g) => follow(startPos.get() - g.dy / Math.max(lift, 1)),
        onPanResponderRelease: (_, g) => settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.get() > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.get() > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos],
  );

  // web: mouse and pen drags on the handle
  useWebDrag(
    handleId,
    {
      onStart: () => startPos.set(pos.get()),
      onMove: (dy) => follow(startPos.get() - dy / Math.max(lift, 1)),
      onEnd: (vy) => settle(vy < -0.3 ? 1 : vy > 0.3 ? 0 : pos.get() > 0.5 ? 1 : 0),
    },
    [heroH, lift],
  );

  // web: the wheel or trackpad first raises the sheet, then scrolls inside it; scrolling up past its top lowers it
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = document.getElementById(id);
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return;
      const up = pos.get() > 0.5;
      if (e.deltaY > 0 && !up) {
        e.preventDefault();
        settle(1);
      } else if (e.deltaY < 0 && up && listY.current <= 0) {
        e.preventDefault();
        settle(0);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroH, lift]);

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: -pos.get() * lift }] }));
  const inset = useAnimatedStyle(() => ({ marginBottom: (1 - Math.min(1, Math.max(0, pos.get()))) * lift }));
  const heroAnim = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.get()));
    return { opacity: 1 - t * 0.25, transform: [{ scale: 1 - t * 0.05 }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, pos.get())) * 0.45 }));

  const toggle = () => {
    haptic.tap();
    settle(pos.get() > 0.5 ? 0 : 1);
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[{ paddingTop: Math.max(insets.top, 6) }, heroStyle, heroAnim]} onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}>
        {hero}
      </Animated.View>

      {/* the card dims as the sheet comes up over it; tap it to lower the sheet */}
      <Animated.View style={[styles.fillAbs, { backgroundColor: dim }, shade]} pointerEvents={raised ? 'auto' : 'none'}>
        <Pressable style={styles.fillAbs} onPress={() => settle(0)} accessibilityRole="button" accessibilityLabel="Lower the sheet" />
      </Animated.View>

      {heroH ? (
        <Animated.View nativeID={id} style={[styles.sheet, { top: heroH + space.md, bottom: -lift }, sheet]}>
          <View nativeID={handleId} {...pan.panHandlers}>
            <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Expand or collapse" hitSlop={10} style={[styles.handleHit, webCursor]}>
              <View style={styles.handle} />
            </Pressable>
            {head}
          </View>
          {/* the part of the sheet still below the screen is trimmed off, so the content always ends on screen */}
          <Animated.View style={[styles.fill, inset]}>
            <ScrollView
              style={styles.fill}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => (listY.current = e.nativeEvent.contentOffset.y)}
              onScrollBeginDrag={() => {
                if (pos.get() < 0.5) settle(1);
              }}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y <= 0 && pos.get() > 0.5 && (e.nativeEvent.velocity?.y ?? 0) < -0.2) settle(0);
              }}
              contentContainerStyle={{ paddingBottom: contentBottom }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  fillAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -8px 24px rgba(10, 28, 62, 0.08), 0 -1px 3px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 6 }),
  },
  handleHit: { alignSelf: 'center', paddingTop: 10, paddingBottom: 8, paddingHorizontal: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD7CB' },
});
