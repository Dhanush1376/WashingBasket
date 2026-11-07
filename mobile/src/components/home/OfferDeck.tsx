import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Offer } from '../../types/models';
import { Ticket, ticketHeight, ticketShadow, ticketTheme, type TicketTheme } from '../offers/Ticket';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none' } as object) : null;
// sideways finger drags come to the deck, up-and-down ones still scroll the page
const webDeck = Platform.OS === 'web' ? ({ touchAction: 'pan-y', userSelect: 'none' } as object) : null;

const VISIBLE = 3; // coupons drawn in the hand; the rest wait, hidden, at the back
const FAN_X = 14; // each coupon behind sits this much further right…
const FAN_Y = 10; // …this much higher…
const FAN_TURN = 3; // …and turned this many degrees more, so its colour shows at the top-right like a fanned hand
const SHRINK = 0.035; // and this much smaller
const SWIPE = 70; // how far a drag must go to send the top coupon to the back
const SPRING = { damping: 18, stiffness: 170, mass: 0.8 };
const AUTO_MS = 3600; // the hand shuffles itself this often…
const QUIET_TURNS = 2; // …but sits out this many turns after the customer touches it

/**
 * The offers as a hand of coupons, the same tickets as the Offers page: the top one in full, the next two fanned out
 * behind it with their colours showing. Swipe the top coupon either way (or tap the dots) to slip it to the back; tap a
 * coupon to open Offers. With `auto`, it shuffles itself every few seconds while nobody is touching it.
 */
export function OfferDeck({
  offers,
  onOpen,
  onTop,
  auto = false,
}: {
  offers: Offer[];
  onOpen: (offerId: string) => void;
  /** Told which coupon is on top, whenever it changes. */
  onTop?: (offer: Offer) => void;
  auto?: boolean;
}) {
  const live = useMemo(() => offers.filter((o) => o.status !== 'expired'), [offers]);
  const n = live.length;
  const [top, setTop] = useState(0);
  const [deckW, setDeckW] = useState(0);
  const drag = useSharedValue(0);
  const busy = useSharedValue(false); // true while the top coupon flies off
  const quiet = useSharedValue(0); // shuffles to sit out, after the customer swipes or taps a dot
  const count = useSharedValue(n);
  useEffect(() => {
    count.set(n);
  }, [n, count]);

  const { pan, fling, settle } = useMemo(() => {
    const settle = () => drag.set(withSpring(0, SPRING));
    const advance = () => {
      setTop((t) => (t + 1) % Math.max(count.get(), 1));
      drag.set(0);
      busy.set(false);
    };
    const fling = (dir: number) => {
      if (busy.get() || count.get() < 2) return settle();
      busy.set(true);
      drag.set(
        withTiming(dir * 460, { duration: 230 }, (finished) => {
          if (finished) scheduleOnRN(advance);
        }),
      );
    };
    const responder = PanResponder.create({
      // claimed in the capture phase, so a sideways drag works from anywhere on a coupon (its tap area, the barcode,
      // REDEEM) instead of the coupon's own press handling keeping it; taps still reach the coupon
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => quiet.set(QUIET_TURNS),
      onPanResponderMove: (_, g) => drag.set(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE || Math.abs(g.vx) > 0.6) fling(Math.sign(g.dx || g.vx));
        else settle();
      },
      onPanResponderTerminate: settle,
    });
    return { pan: responder, fling, settle };
  }, [drag, busy, count, quiet]);

  // On web the deck follows the pointer itself (mouse, pen or finger), from anywhere on it: the coupons' own SVG and
  // text otherwise took the drag, so only their corners could be swiped. A drag that starts mostly up-and-down is let
  // go, so the page still scrolls; the click that ends a real drag doesn't also open the coupon.
  const deckRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const node = deckRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let state: 'idle' | 'deciding' | 'dragging' = 'idle';

    const move = (e: PointerEvent) => {
      if (state === 'idle') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (state === 'deciding') {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) return finish(); // a scroll, not a swipe
        if (Math.abs(dx) < 6) return;
        state = 'dragging';
        quiet.set(QUIET_TURNS);
      }
      const now = performance.now();
      vx = 0.7 * ((e.clientX - lastX) / Math.max(1, now - lastT)) + 0.3 * vx;
      lastX = e.clientX;
      lastT = now;
      drag.set(dx);
      e.preventDefault();
    };
    const finish = () => {
      const was = state;
      state = 'idle';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      return was;
    };
    const up = (e: PointerEvent) => {
      if (finish() !== 'dragging') return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > SWIPE || Math.abs(vx) > 0.6) fling(Math.sign(dx || vx));
      else settle();
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const cancel = () => {
      if (finish() === 'dragging') settle();
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || busy.get()) return;
      state = 'deciding';
      startX = lastX = e.clientX;
      startY = e.clientY;
      lastT = performance.now();
      vx = 0;
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    };
    const noNativeDrag = (e: Event) => e.preventDefault(); // no ghost-image dragging of the coupon art
    node.addEventListener('pointerdown', down);
    node.addEventListener('dragstart', noNativeDrag);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('dragstart', noNativeDrag);
      finish();
    };
  }, [drag, busy, quiet, fling, settle]);

  // the shuffle: every few seconds the top coupon slides off to the left and tucks in at the back
  useEffect(() => {
    if (!auto || n < 2) return;
    const id = setInterval(() => {
      if (quiet.get() > 0) quiet.set(quiet.get() - 1);
      else fling(-1);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [auto, n, fling, quiet]);

  const topOffer = live[top % Math.max(n, 1)];
  useEffect(() => {
    if (topOffer) onTop?.(topOffer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topOffer?.id]);

  if (!n) return null;

  const fan = Math.min(n, VISIBLE) - 1;
  const w = Math.max(0, deckW - FAN_X * fan - 6); // room on the right for the fanned coupons
  const h = ticketHeight(w);

  const goTo = (i: number) => {
    if (i === top || busy.get()) return;
    quiet.set(QUIET_TURNS);
    setTop(i);
  };

  return (
    <View style={styles.wrap}>
      <View
        ref={deckRef}
        style={[styles.deck, webDeck, { height: h + FAN_Y * fan + 14, paddingTop: FAN_Y * fan + 6 }]}
        onLayout={(e) => setDeckW(e.nativeEvent.layout.width)}
        {...(Platform.OS === 'web' ? null : pan.panHandlers)}
      >
        {w > 0
          ? live.map((o, i) => {
              const at = offers.indexOf(o);
              return (
                <DeckCard
                  key={o.id}
                  offer={o}
                  no={at + 1}
                  theme={ticketTheme(o, at)}
                  pos={(i - top + n) % n}
                  w={w}
                  h={h}
                  top={FAN_Y * fan + 6}
                  drag={drag}
                  onPress={() => onOpen(o.id)}
                />
              );
            })
          : null}
      </View>

      {n > 1 ? (
        <View style={styles.dots}>
          {live.map((o, i) => (
            <Pressable key={o.id} onPress={() => goTo(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show offer ${i + 1} of ${n}`}>
              <View style={[styles.dot, i === top && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DeckCard({
  offer,
  no,
  theme,
  pos,
  w,
  h,
  top,
  drag,
  onPress,
}: {
  offer: Offer;
  no: number;
  theme: TicketTheme;
  pos: number;
  w: number;
  h: number;
  top: number;
  drag: SharedValue<number>;
  onPress: () => void;
}) {
  const p = useSharedValue(pos);
  useEffect(() => {
    p.set(withSpring(pos, SPRING));
  }, [pos, p]);

  const front = pos === 0;
  const anim = useAnimatedStyle(() => {
    const at = p.get();
    const x = front ? drag.get() : 0;
    return {
      opacity: interpolate(at, [VISIBLE - 1, VISIBLE], [1, 0], 'clamp'),
      transform: [
        { translateX: x + at * FAN_X },
        { translateY: -at * FAN_Y },
        { rotate: `${at * FAN_TURN + x / 22}deg` },
        { scale: 1 - at * SHRINK },
      ],
    };
  });

  return (
    <Animated.View style={[styles.slot, { top, width: w, height: h, zIndex: 10 - pos }, ticketShadow, anim]} pointerEvents={front ? 'auto' : 'none'}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${offer.title}. ${offer.description}${offer.code ? ` Code ${offer.code}.` : ''}`}
        style={({ pressed }) => [webCursor, pressed && { transform: [{ scale: 0.985 }] }]}
      >
        <Ticket offer={offer} theme={theme} no={no} w={w} h={h} onRedeem={onPress} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  deck: { position: 'relative' },
  slot: { position: 'absolute', left: 0 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D9D3C6' },
  dotOn: { width: 18, backgroundColor: '#0A1C3E' },
});
