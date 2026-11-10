import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { TopBar } from '../../components/app/TopBar';
import { Icon, type IconName } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Button, fade } from '../../components/app/primitives';
import { EmptyState, ErrorState, Skeleton } from '../../components/app/states';
import { FloatingBottomBar } from '../../components/navigation/FloatingBottomBar';
import { dateParts } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { keys, useQuery } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { listOffers } from '../../services/mock/account.service';
import { serviceById } from '../../services/mock/pricing.service';
import { app, brand, colors, fonts, space } from '../../theme';
import type { Offer, OfferStatus } from '../../types/models';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const CLAMP = Extrapolation.CLAMP;
const TILT = -3; // every coupon rests at the same slight anti-clockwise tilt
const DWELL = 4500; // how long auto-play holds each coupon
const AUTO_LIMIT = 30000; // auto-play runs this long, then rests on whichever coupon is showing
const CHARCOAL = '#0A1C3E'; // warm near-black: sits with the beige where navy would clash
const STAGE = '#EAE6DB'; // warm stone beige behind the coupons, so the white sheet still reads as a layer over them
const SHEET_OVERLAP = 22; // how far the details sheet rides up over the coupon stage
const GREEN_TAG = { fg: '#0F8A26', bg: '#E3F7E6' };
const AMBER = { fg: '#B46A00', bg: '#FFF1D6' };
const GREY_TAG = { fg: '#5B6475', bg: '#E9EBEF' };
const SLIDE_TOP = 14; // room above each coupon for its lift and tilt
const SLIDE_ROOM = 84; // extra height per slide: the shadows below must end inside it, or the scroller cuts them into a hard line
const SHEET_ID = 'offer-details-sheet'; // lets the web wheel listener find the sheet
const RESUME_AFTER = 45000; // after the customer touches the coupons or reads the details, auto-play waits this long

/** Logo-matching brand palette sampled directly from the logo and reference:
 * 1. Deep Brand Navy (white text)
 * 2. Vibrant Brand Orange (white text)
 * 3. Deep Brand Crimson Red (white text)
 * 4. Warm Golden Yellow (navy text)
 */
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' });
type Theme = { paper: string; stub: string; ink: string };
const THEMES: Theme[] = [
  { paper: '#013E86', stub: '#002A5C', ink: '#FFFFFF' }, // brand navy
  { paper: '#FFA742', stub: '#E08620', ink: '#FFFFFF' }, // brand orange
  { paper: '#D30D24', stub: '#A80A1C', ink: '#FFFFFF' }, // brand red
  { paper: '#FEDB7D', stub: '#F7C35D', ink: '#012A5C' }, // warm yellow
  { paper: '#0A4E9E', stub: '#063773', ink: '#FFFFFF' }, // royal blue
  { paper: '#FF6F3C', stub: '#E05322', ink: '#FFFFFF' }, // coral
  { paper: '#0284C7', stub: '#0369A1', ink: '#FFFFFF' }, // sky blue
  { paper: '#12AD2B', stub: '#0D8220', ink: '#FFFFFF' }, // brand green
];

const THEME_BY_CODE: Record<string, Theme> = {
  FREEDEL: THEMES[0], // #013E86 Navy
  CLEAN15: { paper: '#FEC837', stub: '#EFB21C', ink: '#0A1C3E' }, // the brand's warm yellow
  WINTER10: THEMES[2], // #D30D24 Red
  MONSOON: THEMES[3], // #FEDB7D Yellow
  FIRSTWASH: THEMES[5], // #FF6F3C Coral
};

const themeFor = (o: Offer, i: number) => THEME_BY_CODE[o.code ?? ''] ?? THEMES[i % THEMES.length];

type Filter = 'all' | OfferStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Deals' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'expired', label: 'Expired' },
];

/** The one thing the eye should land on: "15%", "FREE", "EXTRA". */
function headline(o: Offer) {
  const badge = (o.discountBadge ?? o.discountValue ?? 'DEAL').toUpperCase();
  const pct = badge.match(/(\d+)\s*%/);
  if (pct) return { big: `${pct[1]}%`, small: 'OFF' };
  if (badge.startsWith('FREE')) return { big: 'FREE', small: badge.slice(4).trim() || 'OFFER' };
  const [first, ...rest] = badge.split(' ');
  return { big: first, small: rest.join(' ') || 'OFFER' };
}

const short = (iso: string) => {
  const p = dateParts(iso);
  return `${p.day} ${p.month}`;
};
const validity = (o: Offer) =>
  (o.status === 'expired' ? `Ended ${short(o.validUntil)}` : o.status === 'upcoming' ? `From ${short(o.validFrom)}` : `Till ${short(o.validUntil)}`).toUpperCase();
const codeOf = (o: Offer) => o.code ?? o.id.toUpperCase();
const daysLeft = (o: Offer) => Math.max(0, Math.ceil((new Date(`${o.validUntil}T23:59:59`).getTime() - Date.now()) / 86400000));

export function OffersScreen({ navigation, route }: ScreenProps<'Offers'>) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const offers = useQuery(keys.offers, listOffers);
  const [filter, setFilter] = useState<Filter>('all');
  // the coupon tapped on Home's offer deck: the carousel opens on it (until the customer changes the filter)
  const [focusId, setFocusId] = useState(route.params?.offerId);
  const [pageW, setPageW] = useState(winW);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<{ offer: Offer; theme: Theme; no: number; from?: Origin } | null>(null);
  const [heroH, setHeroH] = useState(0);
  const [interaction, setInteraction] = useState(0); // bumps whenever the customer reads the details

  const list = (offers.data ?? []).filter((o) => filter === 'all' || o.status === filter);
  const current = list[Math.min(index, list.length - 1)];
  const startAt = focusId ? Math.max(0, list.findIndex((o) => o.id === focusId)) : 0;
  const cardW = Math.round(Math.min(308, Math.max(274, pageW * 0.78)));
  const cardH = Math.round(cardW * 0.56);
  const book = () => navigation.navigate('Main', { screen: 'Book' });

  // like the sign-in sheet: drag it (or tap its handle) and it rises over the coupons, which dim and recede.
  // It follows the finger, then springs to whichever rest the flick or distance points to.
  const lift = Math.round(cardH * 0.6);
  const pos = useSharedValue(0); // 0 = resting, 1 = raised
  const startPos = useRef(0);
  const settle = (to: number) => {
    pos.value = withSpring(to, { damping: 22, stiffness: 240, mass: 0.8 });
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        // vertical drags only, so taps on the buttons and the code still work
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          startPos.current = pos.value;
          setInteraction((n) => n + 1);
        },
        onPanResponderMove: (_, g) => {
          const p = startPos.current - g.dy / lift;
          pos.value = p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p; // a little give past either end
        },
        onPanResponderRelease: (_, g) => settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.value > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos],
  );
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pos.value * lift }] }));

  // on web, the mouse wheel or trackpad scroll moves the sheet too: scroll down raises it, scroll up lowers it
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = document.getElementById(SHEET_ID);
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      setInteraction((n) => n + 1);
      settle(e.deltaY > 0 ? 1 : 0);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroH, current?.id]);
  const heroStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: 1 - t * 0.45, transform: [{ scale: 1 - t * 0.04 }] };
  });
  const sheetTop = heroH - SHEET_OVERLAP;

  return (
    <View style={styles.root}>
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 6) }]}>
        <TopBar padded={false} title="Offers" />
        <FilterTabs
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setIndex(0);
            setFocusId(undefined);
          }}
        />
      </View>

      <View
        style={styles.stage}
        onLayout={(e) => {
          setPageW(Math.round(e.nativeEvent.layout.width));
        }}
      >
        {offers.loading ? (
          <View style={[styles.carouselSlot, { height: cardH + 76 }]}>
            <Skeleton width={cardW} height={cardH} radius={18} />
          </View>
        ) : offers.error ? (
          <ErrorState onRetry={offers.refetch} />
        ) : current ? (
          <>
            <Animated.View style={[styles.hero, heroStyle]} onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}>
              {/* keyed by filter, so a new filter starts again from the first coupon with auto-play on */}
              <Rise key={filter} distance={14}>
              <Carousel
              offers={list}
              startAt={startAt}
              pageW={pageW}
              cardW={cardW}
              cardH={cardH}
              paused={!!open}
              interaction={interaction}
              onIndex={setIndex}
              hiddenId={open?.offer.id}
              onOpen={(offer, theme, no, from) => {
                haptic.tap();
                setOpen({ offer, theme, no, from });
              }}
              onRedeem={book}
              />
              </Rise>
            </Animated.View>
            {/* like the sign-in sheet: white, rounded on top, overlapping the bottom of the coupon stage;
                it reaches `lift` below the screen so nothing shows underneath once it has risen */}
            {heroH ? (
              <Animated.View nativeID={SHEET_ID} style={[styles.sheet, { top: sheetTop, bottom: -lift }, sheetStyle]} {...pan.panHandlers}>
                <Pressable
                  onPress={() => {
                    setInteraction((n) => n + 1);
                    settle(pos.value > 0.5 ? 0 : 1);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Show more or less of the offer details"
                  hitSlop={10}
                  style={[styles.handleHit, webCursor]}
                >
                  <View style={styles.handle} />
                </Pressable>
                <View style={styles.sheetBody}>
                  {/* keyed by offer, so each change of coupon eases the new details in */}
                  <OfferDetails key={current.id} offer={current} theme={themeFor(current, index)} />
                </View>
              </Animated.View>
            ) : null}
            {heroH ? <OfferActions offer={current} onBook={book} bottom={Math.max(insets.bottom, 12) + 68} /> : null}
          </>
        ) : (
          <EmptyState icon="tag" title="No offers here" message="Try a different filter above." />
        )}
      </View>

      <FloatingBottomBar />

      {open ? (
        <CouponReveal
          offer={open.offer}
          theme={open.theme}
          no={open.no}
          from={open.from}
          onClose={() => setOpen(null)}
          onBook={() => {
            setOpen(null);
            book();
          }}
        />
      ) : null}
    </View>
  );
}

/* ───────────── Filter tabs: a single dark highlight glides between them ───────────── */

const TAB_GLIDE = { duration: 340, easing: Easing.bezier(0.22, 1, 0.36, 1) };

function FilterTabs({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const [boxes, setBoxes] = useState<Partial<Record<Filter, { x: number; w: number }>>>({});
  // the highlight moves at once; the (heavier) swap of coupons follows once the glide is under way,
  // so rebuilding the carousel never stalls the slide
  const [selected, setSelected] = useState(value);
  useEffect(() => setSelected(value), [value]);
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    const b = boxes[selected];
    if (!b) return;
    if (!w.value) {
      // first placement: no slide in from nowhere
      x.value = b.x;
      w.value = b.w;
    } else {
      x.value = withTiming(b.x, TAB_GLIDE);
      w.value = withTiming(b.w, TAB_GLIDE);
    }
  }, [selected, boxes, x, w]);

  const highlight = useAnimatedStyle(() => ({ width: w.value, opacity: w.value ? 1 : 0, transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.filtersRow}>
      {/* white pills underneath, the gliding highlight over them, then the labels on top */}
      <View style={[StyleSheet.absoluteFill, styles.tabsLayer]} pointerEvents="none">
        {FILTERS.map((f) => (
          <View key={f.id} style={[styles.filterTab, styles.filterTabBase]} />
        ))}
      </View>
      <Animated.View style={[styles.tabHighlight, highlight]} pointerEvents="none" />
      {FILTERS.map((f) => {
        const on = f.id === selected;
        return (
          <Pressable
            key={f.id}
            onLayout={(e) => {
              const { x: bx, width: bw } = e.nativeEvent.layout;
              setBoxes((prev) => (prev[f.id]?.x === bx && prev[f.id]?.w === bw ? prev : { ...prev, [f.id]: { x: bx, w: bw } }));
            }}
            onPress={() => {
              if (on) return;
              haptic.tap();
              setSelected(f.id);
              setTimeout(() => onChange(f.id), 300);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.filterTab, webCursor]}
          >
            <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────────── Carousel: one coupon per page, auto-playing for a while ───────────── */

function Carousel({
  offers,
  pageW,
  cardW,
  cardH,
  paused,
  interaction,
  onIndex,
  onOpen,
  onRedeem,
  hiddenId,
  startAt = 0,
}: {
  offers: Offer[];
  /** The coupon to open on: no opening spin and no auto-play, so it stays on the one the customer picked. */
  startAt?: number;
  pageW: number;
  cardW: number;
  cardH: number;
  paused: boolean;
  interaction: number;
  onIndex: (i: number) => void;
  onOpen: (offer: Offer, theme: Theme, no: number, from?: Origin) => void;
  onRedeem: () => void;
  hiddenId?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const progress = useSharedValue(0); // how far through its hold the current coupon is
  const [auto, setAuto] = useState(!reduced && offers.length > 1 && !startAt);
  const [tick, setTick] = useState(0);
  const startedAt = useRef(0);
  useEffect(() => {
    if (!startedAt.current) startedAt.current = Date.now();
  }, []);
  const autoSV = useSharedValue(auto ? 1 : 0);

  const centred = useSharedValue(0);
  const spinSV = useSharedValue(0); // 1 while the opening spin runs
  const programmatic = useSharedValue(0); // 1 while auto-play or a tap is moving the carousel
  const lastHold = useSharedValue(0);
  // a stable callback for the scroll worklet, always calling the latest holdAuto
  const holdRef = useRef<() => void>(() => {});
  const holdFromScroll = useRef(() => holdRef.current()).current;
  const n = offers.length;
  const loop = n > 1;
  const slides = loop ? [offers[n - 1], ...offers, offers[0], offers[1]] : offers;
  const realOf = (slide: number) => (loop ? (((slide - 1) % n) + n) % n : slide);
  const glideTo = (i: number) => {
    programmatic.set(1);
    ref.current?.scrollTo({ x: i * pageW, animated: true });
    setTimeout(() => programmatic.set(0), 900);
  };
  // landing on a copy at either end swaps, without a visible jump, to the real coupon it shows
  const wrapFrom = (slide: number) => {
    programmatic.set(1);
    ref.current?.scrollTo({ x: (slide === 0 ? n : slide - n) * pageW, animated: false });
    setTimeout(() => programmatic.set(0), 400);
  };
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    // a scroll nobody asked the code for is the customer's own (touch, mouse drag, wheel or trackpad)
    if (!programmatic.value) {
      const now = Date.now();
      if (now - lastHold.value > 800) {
        lastHold.value = now;
        scheduleOnRN(holdFromScroll);
      }
    }
    // tell the screen which coupon is centred, so the details below follow it
    const raw = Math.round(e.contentOffset.x / pageW);
    const i = loop ? (((raw - 1) % n) + n) % n : Math.max(0, Math.min(n - 1, raw));
    if (loop && !spinSV.value && (raw === 0 || raw > n) && Math.abs(e.contentOffset.x - raw * pageW) < 1) scheduleOnRN(wrapFrom, raw);
    // while the opening spin runs, the details below stay put instead of re-rendering for every coupon that flies past
    if (i !== centred.value && !spinSV.value) {
      centred.value = i;
      scheduleOnRN(onIndex, i);
    }
  });

  useEffect(() => {
    autoSV.value = withTiming(auto ? 1 : 0, { duration: 200 });
  }, [auto, autoSV]);

  // opening spin: the coupons whirl forward one full lap and slow to a stop on the first,
  // like a wheel settling. Snapping is off while it runs so every frame can land between coupons.
  const [spinning, setSpinning] = useState(!reduced && offers.length > 1 && !startAt);
  // wait until every slide is laid out, or the browser clamps the first scroll back to the start
  const [ready, setReady] = useState(false);
  // hidden until the spin has put itself in place, so the copy of the last coupon never flashes up first
  const [shown, setShown] = useState(!loop);
  const onContentSize = (w: number) => {
    if (!ready && w >= slides.length * pageW - 1) setReady(true);
  };
  useEffect(() => {
    if (!loop || !ready) return;
    if (reduced || startAt) {
      ref.current?.scrollTo({ x: (startAt + 1) * pageW, animated: false });
      requestAnimationFrame(() => setShown(true));
      return;
    }
    const from = pageW; // the real first coupon
    const to = (n + 1) * pageW; // its copy after the last: one full lap forward
    const dur = 2000;
    let raf = 0;
    let start = 0;
    let done = false;
    programmatic.set(1);
    spinSV.set(1);
    ref.current?.scrollTo({ x: from, animated: false });
    const finish = () => {
      if (done) return;
      done = true;
      setShown(true);
      cancelAnimationFrame(raf);
      // snapping comes back first, then the swap from the copy to the real first coupon (they look identical);
      // done the other way round, the browser re-snaps to the copy for a moment
      setSpinning(false);
      setTimeout(() => {
        ref.current?.scrollTo({ x: from, animated: false });
        spinSV.set(0);
      }, 90);
      // keep the flag up until that scroll's own event has passed, or it reads as the customer's and pauses auto-play
      setTimeout(() => programmatic.set(0), 450);
      startedAt.current = Date.now();
      setTick((k) => k + 1); // auto-play starts its first hold now
    };
    const safety = setTimeout(finish, dur + 900);
    const frame = (now: number) => {
      if (!start) {
        start = now + 140; // a breath on the first coupon before it spins
        setShown(true);
      }
      const t = Math.min(1, Math.max(0, (now - start) / dur));
      const eased = 1 - Math.pow(1 - t, 4); // fast at first, a long gentle stop
      ref.current?.scrollTo({ x: from + (to - from) * eased, animated: false });
      if (t < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      finish();
    };
    // if frames stall, the safety finish still shows it
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // hold, glide to the next coupon, repeat; loops back to the first; stops once the time limit is up
  useEffect(() => {
    if (!auto || paused || spinning) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DWELL, easing: Easing.linear });
    const id = setTimeout(() => {
      if (Date.now() - startedAt.current >= AUTO_LIMIT) {
        setAuto(false);
        return;
      }
      const here = Math.round(scrollX.value / pageW);
      const next = loop ? here + 1 : (here + 1) % n;
      glideTo(next);
      setTick((t) => t + 1);
    }, DWELL);
    return () => clearTimeout(id);
  }, [auto, paused, spinning, tick, pageW, offers.length, progress, scrollX, ref]);

  // any touch means the customer is reading: hold still, then pick up again after a quiet spell
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdAuto = () => {
    setAuto(false);
    clearTimeout(resumeTimer.current);
    if (reduced || offers.length < 2) return;
    resumeTimer.current = setTimeout(() => {
      startedAt.current = Date.now();
      setAuto(true);
    }, RESUME_AFTER);
  };
  holdRef.current = holdAuto;
  useEffect(() => () => clearTimeout(resumeTimer.current), []);
  // reading the details below counts too
  useEffect(() => {
    if (interaction) holdAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction]);

  return (
    <View style={styles.carouselSlot}>
      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled={!spinning}
        onContentSizeChange={onContentSize}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={holdAuto}
        onTouchStart={holdAuto}
        scrollEventThrottle={16}
        style={{ width: pageW, flexGrow: 0, opacity: shown ? 1 : 0 }}
      >
        {slides.map((o, i) => (
          <Slide key={`${o.id}-${i}`} index={i} scrollX={scrollX} pageW={pageW} cardW={cardW} cardH={cardH} height={cardH + SLIDE_ROOM} hidden={o.id === hiddenId}>
            <PressableTicket
              offer={o}
              theme={themeFor(o, realOf(i))}
              no={realOf(i) + 1}
              w={cardW}
              h={cardH}
              onPress={(from) => {
                holdAuto();
                if (i === Math.round(scrollX.value / pageW)) onOpen(o, themeFor(o, realOf(i)), realOf(i) + 1, from);
                else glideTo(i);
              }}
              onRedeem={onRedeem}
            />
          </Slide>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {offers.map((o, i) => (
          <Segment key={o.id} index={loop ? i + 1 : i} scrollX={scrollX} pageW={pageW} progress={progress} auto={autoSV} />
        ))}
      </View>
    </View>
  );
}

/** Every coupon keeps the same slight tilt; the neighbours wait smaller and softer until it is their turn. */
const GAP = 16; // clear space between the centred coupon and its neighbours
const SIDE_SCALE = 0.84;

function Slide({
  index,
  scrollX,
  pageW,
  cardW,
  cardH,
  height,
  hidden,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  pageW: number;
  cardW: number;
  cardH: number;
  height: number;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  // pull a neighbour in from its own page until its near edge sits GAP away from the centred coupon
  // (a neighbour's own centre is a full page away, so the pull is a page minus both half-widths and the gap)
  const pull = pageW - (cardW / 2) * (1 + SIDE_SCALE) - GAP;
  const anim = useAnimatedStyle(() => {
    const x = scrollX.value / pageW - index; // 0 = centred, -1 = waiting on the right, 1 = gone left
    return {
      opacity: interpolate(x, [-1, 0, 1], [0.85, 1, 0.85], CLAMP), // barely faded: the next coupon stays clearly visible
      transform: [
        { translateX: interpolate(x, [-1, 0, 1], [-pull, 0, pull], CLAMP) },
        { translateY: interpolate(x, [-1, 0, 1], [0, -5, 0], CLAMP) }, // the centred coupon lifts off the page
        { rotate: `${TILT}deg` },
        { scale: interpolate(x, [-1, 0, 1], [SIDE_SCALE, 1, SIDE_SCALE], CLAMP) },
      ],
    };
  });
  // a soft pool of shadow on the "floor" beneath: deep under the centred coupon, faint under the neighbours
  const floor = useAnimatedStyle(() => {
    const x = scrollX.value / pageW - index;
    return {
      opacity: interpolate(Math.abs(x), [0, 1], [1, 0.3], CLAMP),
      transform: [{ translateX: interpolate(x, [-1, 0, 1], [-pull, 0, pull], CLAMP) }, { scaleX: interpolate(Math.abs(x), [0, 1], [1, 0.8], CLAMP) }],
    };
  });
  const floorW = Math.round(cardW * 0.8);
  const floorH = 24;
  return (
    <View style={{ width: pageW, height, alignItems: 'center', paddingTop: SLIDE_TOP }}>
      <View style={[StyleSheet.absoluteFill, hidden && { opacity: 0 }]} pointerEvents="none">
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: floorW,
              height: floorH,
              left: (pageW - floorW) / 2,
              top: SLIDE_TOP + cardH - 10,
            },
            floor,
          ]}
        >
          <Svg width={floorW} height={floorH}>
            <Defs>
              <RadialGradient id={`floorGrad-${index}`} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor="#0B1220" stopOpacity="0.22" />
                <Stop offset="45%" stopColor="#0B1220" stopOpacity="0.10" />
                <Stop offset="75%" stopColor="#0B1220" stopOpacity="0.03" />
                <Stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={floorW / 2} cy={floorH / 2} rx={floorW / 2} ry={floorH / 2} fill={`url(#floorGrad-${index})`} />
          </Svg>
        </Animated.View>
      </View>
      <Animated.View style={anim}>
        <View style={hidden ? { opacity: 0 } : null}>{children}</View>
      </Animated.View>
    </View>
  );
}

/** Story-style segment: widens for the current coupon and fills while auto-play holds it. */
function Segment({ index, scrollX, pageW, progress, auto }: { index: number; scrollX: SharedValue<number>; pageW: number; progress: SharedValue<number>; auto: SharedValue<number> }) {
  const track = useAnimatedStyle(() => ({ width: interpolate(Math.abs(scrollX.value / pageW - index), [0, 1], [30, 8], CLAMP) }));
  const fill = useAnimatedStyle(() => {
    const here = Math.round(scrollX.value / pageW) === index;
    const frac = here ? progress.value * auto.value + (1 - auto.value) : 0;
    return { width: `${frac * 100}%` };
  });
  return (
    <Animated.View style={[styles.segment, track]}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </Animated.View>
  );
}

function PressableTicket({
  offer,
  theme,
  no,
  w,
  h,
  onPress,
  onRedeem,
}: {
  offer: Offer;
  theme: Theme;
  no: number;
  w: number;
  h: number;
  onPress: (from?: Origin) => void;
  onRedeem: () => void;
}) {
  const box = useRef<React.ComponentRef<typeof View>>(null);
  const press = useSharedValue(1);
  // measure the coupon's centre on screen, so the opened coupon can fly out from exactly there
  const pressed = () => {
    const node = box.current as unknown as { measureInWindow?: (cb: (x: number, y: number, mw: number, mh: number) => void) => void } | null;
    if (!node?.measureInWindow) return onPress();
    node.measureInWindow((x, y, mw, mh) => onPress({ cx: x + mw / 2, cy: y + mh / 2, w }));
  };
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const { big, small } = headline(offer);
  return (
    <Pressable
      onPress={pressed}
      onPressIn={() => (press.value = withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 16, stiffness: 260 }))}
      accessibilityLabel={`${big} ${small}, ${offer.title}, code ${codeOf(offer)}. Opens the coupon.`}
      style={webCursor}
    >
      <Animated.View style={[styles.ticketShadow, anim]}>
        <View ref={box} collapsable={false}>
          <Ticket offer={offer} theme={theme} no={no} w={w} h={h} onRedeem={onRedeem} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* ───────────── Details of the coupon in view, with the action ───────────── */

function OfferDetails({ offer, theme }: { offer: Offer; theme: Theme }) {
  const left = daysLeft(offer);
  const active = offer.status === 'active';
  const services = offer.serviceIds === 'all' ? [] : offer.serviceIds.map((id) => serviceById(id).name);

  // three fixed rows, one line each, so every coupon's details are exactly the same height
  const valid: { value: string; tag: string; tone: { fg: string; bg: string } } = active
    ? { value: `Till ${short(offer.validUntil)}`, tag: left <= 1 ? 'Last day' : `${left} days left`, tone: left <= 7 ? AMBER : GREEN_TAG }
    : offer.status === 'upcoming'
      ? { value: `${short(offer.validFrom)} – ${short(offer.validUntil)}`, tag: 'Coming soon', tone: AMBER }
      : { value: `Ended ${short(offer.validUntil)}`, tag: 'Expired', tone: GREY_TAG };
  const facts: { icon: IconName; label: string; value: string }[] = [
    { icon: 'shirt', label: 'Applies to', value: services.length ? services.join(', ') : 'All services' },
    { icon: 'user', label: 'Eligible', value: offer.eligibility },
  ];

  return (
    <Rise distance={8}>
      <View style={styles.detailsHead}>
        <View style={styles.headTopRow}>
          <Text style={styles.detailsTitle} numberOfLines={1}>
            {offer.title}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: valid.tone.bg }]}>
            <View style={[styles.statusChipDot, { backgroundColor: valid.tone.fg }]} />
            <Text style={[styles.statusChipText, { color: valid.tone.fg }]}>{valid.tag}</Text>
          </View>
        </View>
        <Text style={styles.detailsBody} numberOfLines={2}>
          {offer.description}
        </Text>
      </View>

      <View style={styles.facts}>
        {facts.map((f, i) => (
          <View
            key={f.label}
            style={[styles.factRow, i > 0 && styles.factRowRule]}
            accessible
            accessibilityLabel={`${f.label}: ${f.value}`}
          >
            <Icon name={f.icon} size={16} color={colors.inkMuted} />
            <Text style={styles.factLabel}>{f.label}</Text>
            <Text style={styles.factValue} numberOfLines={1}>
              {f.value}
            </Text>
          </View>
        ))}
      </View>

      {/* a short note on how to use it: only what's true today (booking has no code field yet) */}
      <View style={styles.note}>
        <Icon name="info" size={15} color="#9A6A00" />
        <Text style={styles.noteText} numberOfLines={2}>
          {active
            ? `Tap the code to copy it. Valid on ${services.length ? services.join(', ') : 'all services'} till ${short(offer.validUntil)}.`
            : offer.status === 'upcoming'
              ? `This code can be used from ${short(offer.validFrom)}.`
              : `This offer ended on ${short(offer.validUntil)}.`}
        </Text>
      </View>

    </Rise>
  );
}

/** The code and Book now, pinned above the tab bar like Top Up on the wallet: the details scroll beneath. */
function OfferActions({ offer, onBook, bottom }: { offer: Offer; onBook: () => void; bottom: number }) {
  const [copied, setCopied] = useState(false);
  const code = codeOf(offer);
  const active = offer.status === 'active';
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const label = active ? 'Book now' : offer.status === 'upcoming' ? 'Coming soon' : 'Ended';
  return (
    <View style={[styles.actionBar, { paddingBottom: bottom }]} pointerEvents="box-none">
      <View style={styles.actionFade} pointerEvents="none" />
      <View style={styles.actionRow}>
        <Button
          label={copied ? 'Copied' : code}
          variant="outline"
          icon={copied ? 'check' : 'copy'}
          onPress={copy}
          style={styles.actionBtn}
        />
        <Button
          label={label}
          variant="dark"
          icon="arrowRight"
          disabled={!active}
          onPress={onBook}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
}

/* ───────────── The ticket: stub, side notches, barcode, VIEW / REDEEM ───────────── */

function ticketPath(w: number, h: number, r: number, n: number, y: number) {
  return (
    `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${y - n}A${n} ${n} 0 0 0 ${w} ${y + n}V${h - r}` +
    `A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${y + n}A${n} ${n} 0 0 0 0 ${y - n}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
  );
}

/** The left stub of a ticket: rounded outer corners and the half-circle notch, square where it meets the body. */
function stubPath(sw: number, h: number, r: number, n: number, y: number) {
  return `M${sw} 0H${r}A${r} ${r} 0 0 0 0 ${r}V${y - n}A${n} ${n} 0 0 1 0 ${y + n}V${h - r}A${r} ${r} 0 0 0 ${r} ${h}H${sw}Z`;
}

/** Bar widths for a decorative barcode, derived from the code so each coupon's looks different. */
function bars(code: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const c = code.charCodeAt(i % code.length) + i * 7;
    return { w: 1 + (c % 3), gap: 1 + ((c >> 2) % 2) };
  });
}

function Ticket({
  offer,
  theme,
  no,
  w,
  h,
  reveal = false,
  onRedeem,
}: {
  offer: Offer;
  theme: Theme;
  no: number;
  w: number;
  h: number;
  reveal?: boolean;
  onRedeem?: () => void;
}) {
  const u = w / 330;
  const stubW = Math.round(56 * u);
  const d = ticketPath(w, h, 16 * u, 11 * u, h / 2);
  const { big, small } = headline(offer);
  const code = codeOf(offer);
  const ink = theme.ink;
  const pad = 14 * u;
  const bigSize = (big.length > 3 ? 44 : 54) * u;

  const isExpired = offer.status === 'expired';
  const faded = offer.status !== 'active';
  const textOpacity = isExpired ? 0.35 : faded ? 0.45 : 1;

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Path d={d} fill={theme.paper} />
        {/* a faint light edge, like printed card catching the light */}
        <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1.5} />
        {/* the stub is its own shape with the ticket's corners and notch, so it never needs clipping (web ignored the clip) */}
        <Path d={stubPath(stubW, h, 16 * u, 11 * u, h / 2)} fill={theme.stub} />
        <Line
          x1={stubW}
          y1={0}
          x2={stubW}
          y2={h}
          stroke={ink}
          strokeWidth={1.2}
          strokeDasharray={`${3 * u} ${3 * u}`}
          strokeOpacity={textOpacity}
        />
      </Svg>

      {/* stub: DISCOUNT reading upwards, like the reference */}
      <View style={[styles.stub, { width: stubW, opacity: textOpacity }]}>
        {/* positioned, not laid out, so the long word is never squeezed to the stub's width before it turns */}
        <View style={[styles.stubTurn, { width: h, height: 18 * u, left: (stubW - h) / 2, top: (h - 18 * u) / 2 }]}>
          <Text style={[styles.stubText, { color: ink, fontSize: 13 * u, lineHeight: 18 * u, letterSpacing: 5 * u }]} numberOfLines={1}>
            DISCOUNT
          </Text>
        </View>
      </View>

      <View style={[styles.main, { left: stubW, padding: pad, paddingRight: pad + 6 * u, opacity: textOpacity }]}>
        {/* top: the big number beside a column of small mono labels on hairlines */}
        <View style={styles.mainTop}>
          <View style={{ flexShrink: 0 }}>
            <Text style={[styles.big, { color: ink, fontSize: bigSize, lineHeight: bigSize * 1.02, letterSpacing: -2 * u }]} numberOfLines={1}>
              {big}
            </Text>
            <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 9.5 * u, letterSpacing: 3 * u, marginTop: -2 * u }]}>{small}</Text>
          </View>
          <View style={[styles.labels, { marginLeft: 10 * u }]}>
            <View style={[styles.ruleRow, { borderColor: ink, paddingBottom: 2.5 * u }]}>
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 8.5 * u, flexShrink: 0 }]}>
                Nº {String(no).padStart(2, '0')}
              </Text>
              <Text
                style={[styles.mono, { color: ink, fontSize: 8.5 * u, flexShrink: 1, textAlign: 'right' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {(offer.badgeLabel ?? 'OFFER').toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.mono, { color: ink, fontSize: 9 * u, lineHeight: 12.5 * u, marginTop: 4 * u }]} numberOfLines={2}>
              {offer.title.toUpperCase()}
            </Text>
            <View style={[styles.ruleRow, { borderColor: ink, borderTopWidth: 1, borderBottomWidth: 0, paddingTop: 2.5 * u, marginTop: 'auto' }]}>
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 8.5 * u, flexShrink: 1 }]} numberOfLines={1}>
                {validity(offer)}
              </Text>
            </View>
          </View>
        </View>

        {/* bottom: barcode with the code, then VIEW / REDEEM */}
        <View style={styles.mainBottom}>
          <View>
            <View style={[styles.barcode, { height: 22 * u }]}>
              {bars(code, 30).map((b, i) => (
                <View key={i} style={{ width: b.w * u, marginRight: b.gap * u, backgroundColor: ink }} />
              ))}
            </View>
            <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10 * u, letterSpacing: 3 * u, marginTop: 3 }]}>{code}</Text>
          </View>
          {reveal ? null : (
            <View style={[styles.links, { gap: 14 * u }]}>
              <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10.5 * u }]}>VIEW</Text>
              {offer.status === 'active' && onRedeem ? (
                <Pressable
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onRedeem();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Redeem ${offer.title}`}
                  style={webCursor}
                >
                  <Text style={[styles.mono, styles.monoBold, styles.underline, { color: ink, fontSize: 10.5 * u }]}>REDEEM</Text>
                </Pressable>
              ) : (
                <Text style={[styles.mono, styles.monoBold, { color: ink, fontSize: 10.5 * u, opacity: 0.55 }]}>{offer.status === 'upcoming' ? 'SOON' : 'ENDED'}</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {offer.status !== 'active' ? (
        <Stamp
          size={Math.round(h * 0.62)}
          color={isExpired ? '#B3261E' : ink}
          top={isExpired ? 'OFFER' : 'COMING'}
          word={isExpired ? 'EXPIRED' : 'SOON'}
          date={isExpired ? short(offer.validUntil) : short(offer.validFrom)}
          style={{ top: h * 0.16, right: w * 0.05 }}
        />
      ) : null}
    </View>
  );
}

/** A round rubber stamp: double ring, dashed inner ring, set at a tilt and slightly faded like real ink. */
function Stamp({ size, color, top, word, date, style }: { size: number; color: string; top: string; word: string; date: string; style: object }) {
  const k = size / 100;
  return (
    <View pointerEvents="none" style={[styles.stamp, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}>
      <View style={[styles.stampInner, { borderRadius: size, borderColor: color, margin: 5 * k }]}>
        <Text style={[styles.stampSmall, { color, fontSize: 8 * k, letterSpacing: 2.4 * k }]}>★ {top} ★</Text>
        <Text style={[styles.stampWord, { color, fontSize: (word.length > 4 ? 15 : 20) * k, letterSpacing: 1.5 * k }]} numberOfLines={1}>
          {word}
        </Text>
        <View style={[styles.stampRule, { backgroundColor: color, width: 46 * k }]} />
        <Text style={[styles.stampSmall, { color, fontSize: 8.5 * k, letterSpacing: 1.6 * k }]}>{date.toUpperCase()}</Text>
      </View>
    </View>
  );
}

/* ───────────── Opening a coupon: it lifts out of the carousel and its code slides out ───────────── */

/** Where the tapped coupon sat on screen: its centre, and its width there. */
type Origin = { cx: number; cy: number; w: number };

const OPEN_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const STRIP_H = 78;
const STRIP_TUCK = 18; // how much of the code strip stays tucked under the coupon
const BTN_H = 54;
const BTN_GAP = 22;

function CouponReveal({ offer, theme, no, from, onClose, onBook }: { offer: Offer; theme: Theme; no: number; from?: Origin; onClose: () => void; onBook: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const w = Math.round(Math.min(360, width - 40));
  const h = Math.round(w * 0.56);
  const code = codeOf(offer);
  const [copied, setCopied] = useState(false);
  const active = offer.status === 'active';

  // the whole set (coupon, code strip, button) is one tilted group, centred on screen
  const total = h + STRIP_H - STRIP_TUCK + BTN_GAP + BTN_H;
  const top = Math.max(insets.top + 64, (height - total) / 2);
  const left = (width - w) / 2;
  // where the coupon's centre ends up once the group is tilted about its own centre
  const theta = (TILT * Math.PI) / 180;
  const d = h / 2 - total / 2;
  const endX = width / 2 - d * Math.sin(theta);
  const endY = top + total / 2 + d * Math.cos(theta);
  const startX = from?.cx ?? endX;
  const startY = from?.cy ?? endY + 40;
  const startScale = from ? from.w / w : 0.9;

  const t = useSharedValue(reduced ? 1 : 0); // the coupon travelling from the carousel to the stage
  const strip = useSharedValue(reduced ? 1 : 0); // the code strip sliding out from under it
  const ui = useSharedValue(reduced ? 1 : 0); // button and close fading in

  useEffect(() => {
    if (reduced) return;
    t.value = withTiming(1, { duration: 560, easing: OPEN_EASE });
    strip.value = withDelay(430, withTiming(1, { duration: 480, easing: OPEN_EASE }));
    ui.value = withDelay(650, withTiming(1, { duration: 320 }));
    const id = setTimeout(() => haptic.tap(), 470); // a soft tick as the code slides out
    return () => clearTimeout(id);
  }, [t, strip, ui, reduced]);

  const close = () => {
    if (reduced) return onClose();
    ui.value = withTiming(0, { duration: 140 });
    strip.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) });
    t.value = withDelay(180, withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) }));
    setTimeout(onClose, 580); // the coupon is back in its place in the carousel by now
  };

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shade = useAnimatedStyle(() => ({ opacity: t.value }));
  const group = useAnimatedStyle(() => ({
    transform: [{ translateX: (startX - endX) * (1 - t.value) }, { translateY: (startY - endY) * (1 - t.value) }, { rotate: `${TILT}deg` }],
  }));
  const card = useAnimatedStyle(() => ({ transform: [{ scale: startScale + (1 - startScale) * t.value }] }));
  const stripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(strip.value, [0, 0.15], [0, 1], CLAMP),
    transform: [{ translateY: -(STRIP_H - STRIP_TUCK) * (1 - strip.value) }],
  }));
  const uiStyle = useAnimatedStyle(() => ({ opacity: ui.value, transform: [{ translateY: (1 - ui.value) * 8 }] }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, shade]}>
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={[StyleSheet.absoluteFill, styles.revealShade]} onPress={close} accessibilityLabel="Close coupon" />
      </Animated.View>

      <Animated.View style={[styles.revealGroup, { top, left, width: w }, group]} pointerEvents="box-none">
        {/* the code strip sits under the coupon and slides out of it */}
        <Animated.View style={[styles.codeStrip, { marginTop: h - STRIP_TUCK, width: w - 28, height: STRIP_H }, stripStyle]}>
          <View style={styles.stripPerf} />
          <View style={styles.stripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stripLabel}>YOUR CODE</Text>
              <Text style={styles.stripCode} numberOfLines={1}>
                {code}
              </Text>
            </View>
            <Pressable
              onPress={copy}
              accessibilityRole="button"
              accessibilityLabel={`Copy code ${code}`}
              style={({ pressed }) => [styles.stripCopy, copied && styles.stripCopied, webCursor, pressed && { opacity: 0.75 }]}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? '#FFFFFF' : colors.ink} />
              <Text style={[styles.stripCopyText, copied && { color: '#FFFFFF' }]}>{copied ? 'Copied' : 'Copy'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.revealCard, card]}>
          <View style={styles.faceShadow}>
            <Ticket offer={offer} theme={theme} no={no} w={w} h={h} reveal />
          </View>
        </Animated.View>

        <Animated.View style={[{ marginTop: BTN_GAP }, uiStyle]}>
          {active ? (
            <Pressable
              onPress={onBook}
              accessibilityRole="button"
              style={({ pressed }) => [styles.revealBtn, styles.revealBtnWhite, webCursor, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.revealBtnText}>Book with this offer</Text>
              <View style={styles.revealBtnArrow}>
                <Icon name="arrowRight" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
          ) : (
            <View style={[styles.revealBtn, styles.revealBtnOff]}>
              <Text style={[styles.revealBtnText, { color: 'rgba(255,255,255,0.7)' }]}>
                {offer.status === 'upcoming' ? `Available from ${short(offer.validFrom)}` : 'This offer has ended'}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.closeWrap, { top: insets.top + 14 }, uiStyle]}>
        <Pressable onPress={close} style={({ pressed }) => [styles.closeBtn, webCursor, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="x" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STAGE }, // one tint from header to stage, so no seam under the filters
  headerWrap: { paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, color: CHARCOAL },
  filtersRow: { flexDirection: 'row', gap: 6, marginTop: space.md, marginBottom: space.md },
  tabsLayer: { flexDirection: 'row', gap: 6 },
  filterTab: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filterTabBase: { backgroundColor: '#F3F0E8', borderWidth: 1, borderColor: 'rgba(60, 45, 20, 0.12)' },
  tabHighlight: { position: 'absolute', top: 0, left: 0, height: 40, borderRadius: 20, backgroundColor: CHARCOAL },
  filterText: { fontFamily: fonts.medium, fontSize: 14, color: CHARCOAL },
  filterTextOn: { fontFamily: fonts.semibold, color: '#FFFFFF' },

  stage: { flex: 1, overflow: 'hidden' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ userSelect: 'none', touchAction: 'pan-x' } as object) : null), // a drag moves the sheet, not a text selection
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -14px 36px rgba(11, 18, 32, 0.16), 0 -2px 8px rgba(11, 18, 32, 0.06)' } as object)
      : { shadowColor: '#0B1220', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 16 }),
  },
  carouselSlot: { alignItems: 'center', justifyContent: 'center', paddingTop: space.xs },
  dots: { flexDirection: 'row', gap: 6, marginTop: -30, marginBottom: space.md + SHEET_OVERLAP },
  segment: { height: 4, borderRadius: 2, backgroundColor: 'rgba(20, 20, 20, 0.12)', overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: 2, backgroundColor: CHARCOAL },

  detailsHead: {},
  headTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, flexShrink: 0 },
  statusChipDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: -0.1 },
  handleHit: { alignSelf: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },
  sheetBody: { paddingHorizontal: space.xl, paddingTop: space.sm },
  detailsTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.6, color: colors.ink },
  detailsBody: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 6 },
  facts: { marginTop: space.lg, borderRadius: 18, backgroundColor: '#F6F7F9', paddingHorizontal: space.lg },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 40 },
  factRowRule: { borderTopWidth: 1, borderTopColor: '#E9EBEF' },
  factLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft, width: 78 },
  factValue: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, textAlign: 'right' },
  factTag: { height: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  factTagText: { fontFamily: fonts.semibold, fontSize: 11 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52, // two lines' room, so every coupon's block keeps one height
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 14,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F3E5C2',
  },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: '#6B5418' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xxl },
  actionFade: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF 30%)' } as object)
      : { backgroundColor: 'rgba(255,255,255,0.94)' }),
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actionBtn: { flex: 1 },
  bookBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: CHARCOAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.xl,
    paddingRight: 6,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 26px rgba(10, 28, 62, 0.28), 0 3px 8px rgba(10, 28, 62, 0.16)' } as object)
      : { shadowColor: CHARCOAL, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 10 }),
  },
  bookText: { fontFamily: fonts.semibold, fontSize: 15.5, color: '#FFFFFF' },
  bookArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.lg,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  codeValue: { fontFamily: MONO, fontWeight: '700', fontSize: 14, letterSpacing: 2, color: colors.ink },

  ticketShadow: {
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.22)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.14)) drop-shadow(0 14px 18px rgba(0, 0, 0, 0.14))' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.24, shadowRadius: 18, elevation: 12 }),
  },
  stub: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  stubTurn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-90deg' }] },
  stubText: { fontFamily: MONO, fontWeight: '700', textAlign: 'center' },
  main: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'space-between', overflow: 'hidden' },
  mainTop: { flexDirection: 'row', flex: 1, minWidth: 0, alignItems: 'flex-start' },
  big: { fontFamily: fonts.extrabold },
  labels: { flex: 1, minWidth: 0, overflow: 'hidden' },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '100%',
    overflow: 'hidden',
    gap: 4,
  },
  mono: { fontFamily: MONO },
  monoBold: { fontWeight: '700' },
  underline: { textDecorationLine: 'underline' },
  mainBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  barcode: { flexDirection: 'row', alignItems: 'stretch' },
  links: { flexDirection: 'row', alignItems: 'center', paddingBottom: 1 },
  stamp: { position: 'absolute', borderWidth: 2.5, opacity: 0.88, transform: [{ rotate: '-14deg' }] },
  stampInner: { flex: 1, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stampSmall: { fontFamily: MONO, fontWeight: '700' },
  stampWord: { fontFamily: fonts.extrabold, marginVertical: 1 },
  stampRule: { height: 1, marginVertical: 2, opacity: 0.8 },

  revealShade: { backgroundColor: 'rgba(4, 7, 14, 0.86)' },
  revealGroup: { position: 'absolute' },
  revealCard: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  faceShadow: {
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35)) drop-shadow(0 18px 30px rgba(0,0,0,0.45))' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.45, shadowRadius: 26, elevation: 16 }),
  },
  codeStrip: {
    alignSelf: 'center',
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingTop: STRIP_TUCK + 6,
    paddingHorizontal: space.lg,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 14px 28px rgba(0,0,0,0.35)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 }),
  },
  stripPerf: { position: 'absolute', top: STRIP_TUCK, left: 12, right: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  stripRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  stripLabel: { fontFamily: MONO, fontWeight: '700', fontSize: 9.5, letterSpacing: 2.2, color: colors.inkMuted },
  stripCode: { fontFamily: MONO, fontWeight: '700', fontSize: 21, letterSpacing: 4, color: colors.ink, marginTop: 2 },
  stripCopy: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: app.navySoft },
  stripCopied: { backgroundColor: '#0F8A26' },
  stripCopyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  revealBtn: {
    alignSelf: 'center',
    width: '92%',
    height: BTN_H,
    borderRadius: BTN_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.xl,
    paddingRight: 7,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 26px rgba(0,0,0,0.35)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 }),
  },
  revealBtnWhite: { backgroundColor: '#FFFFFF' },
  revealBtnOff: { justifyContent: 'center', paddingRight: space.xl, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  revealBtnText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.1, color: colors.ink },
  revealBtnArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  closeWrap: { position: 'absolute', right: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
