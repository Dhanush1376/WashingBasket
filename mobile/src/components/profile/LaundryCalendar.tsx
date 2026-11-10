import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '../../lib/haptics';
import { keys, setQueryData, useQuery } from '../../lib/query';
import { dayKey, getLaundryCalendarEvents } from '../../services/mock/profile.service';
import { colors, fonts, space } from '../../theme';
import type { LaundryEventDetail, LaundryEventType } from '../../types/profile';
import { Icon, type IconName } from '../app/Icon';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer', outline: 'none' } as object) : null;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * What each event looks like on the calendar: a coloured tile with a small icon badge, as in the reference,
 * plus an accent colour for bars and legends (white tiles need something visible to stand for them).
 */
export const EVENT_LOOK: Record<
  LaundryEventType,
  {
    color: string;
    tile: string;
    border: string;
    textColor: string;
    icon: IconName;
    label: string;
  }
> = {
  scheduled_pickup: {
    color: '#0284C7',
    tile: '#56C2F5',
    border: '#29A6E0',
    textColor: '#083344',
    icon: 'calendar',
    label: 'Scheduled',
  },
  handover: {
    color: '#D95B06',
    tile: '#FFA959',
    border: '#EA6C13',
    textColor: '#431407',
    icon: 'truck',
    label: 'Picked up',
  },
  washing: {
    color: '#8522BA',
    tile: '#C682EE',
    border: '#A445D7',
    textColor: '#3B0764',
    icon: 'droplet',
    label: 'Cleaning',
  },
  drying_ironing: {
    color: '#4338CA',
    tile: '#94A3F8',
    border: '#6366F1',
    textColor: '#1E1B4B',
    icon: 'shirt',
    label: 'Drying',
  },
  delivered: {
    color: '#15803D',
    tile: '#5CE08A',
    border: '#22C55E',
    textColor: '#052E16',
    icon: 'check',
    label: 'Delivered',
  },
  cancelled: {
    color: '#DC2626',
    tile: '#F87171',
    border: '#DC2626',
    textColor: '#450A0A',
    icon: 'x',
    label: 'Cancelled',
  },
};
// when a day holds several things, its tile shows the one that matters most
const TILE_ORDER: LaundryEventType[] = ['delivered', 'handover', 'washing', 'drying_ironing', 'scheduled_pickup', 'cancelled'];

const LEGEND: { type: LaundryEventType; label: string }[] = [
  { type: 'scheduled_pickup', label: 'Scheduled' },
  { type: 'handover', label: 'Picked up' },
  { type: 'washing', label: 'Cleaning' },
  { type: 'delivered', label: 'Delivered' },
];

/**
 * A month of real laundry activity: every dot is a recorded pickup, handover, cleaning step or
 * delivery for one of the customer's orders. Tapping a day hands its events to `onSelectDay`.
 */
export function LaundryCalendar({
  width: initialWidth = 340,
  onSelectDay,
  renderDay,
}: {
  width?: number;
  onSelectDay?: (day: string, events: LaundryEventDetail[]) => void;
  /** When given, a tapped date opens a small card pointing at it, filled with this. */
  renderDay?: (day: string, events: LaundryEventDetail[], close: () => void) => React.ReactNode;
}) {
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const width = containerWidth || initialWidth || 340;
  const today = dayKey(new Date().toISOString());
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [outgoing, setOutgoing] = useState<{
    year: number;
    month: number;
    byDay: Map<string, LaundryEventDetail[]>;
  } | null>(null);
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // the date card: which date it points at, and whether it's on its way out
  const [pop, setPop] = useState<{ key: string; index: number; events: LaundryEventDetail[] } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const closePop = () => {
    setSelected(null);
    setLeaving(true);
  };
  const { year, month } = cursor;
  const events = useQuery(keys.profileCalendar(year, month), () => getLaundryCalendarEvents(month, year));

  // Preload adjacent months quietly into cache so paging is always instant
  useEffect(() => {
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    getLaundryCalendarEvents(next.month, next.year).then((d) => setQueryData(keys.profileCalendar(next.year, next.month), d));
    getLaundryCalendarEvents(prev.month, prev.year).then((d) => setQueryData(keys.profileCalendar(prev.year, prev.month), d));
  }, [year, month]);

  // only this month's events count, so the previous month's data never lands on the wrong days
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const byDay = useMemo(() => {
    const map = new Map<string, LaundryEventDetail[]>();
    (events.data ?? []).forEach((e) => {
      const k = dayKey(e.at);
      if (!k.startsWith(prefix)) return;
      map.set(k, [...(map.get(k) ?? []), e]);
    });
    return map;
  }, [events.data, prefix]);

  const animProgress = useSharedValue(1);
  const titleProgress = useSharedValue(1);

  const clearOutgoing = useCallback(() => {
    setOutgoing(null);
  }, []);

  const step = (delta: number) => {
    haptic.tap();
    setSelected(null);
    setPop(null);
    setLeaving(false);

    // Save current month as outgoing for cross-slide
    setOutgoing({
      year: cursor.year,
      month: cursor.month,
      byDay: new Map(byDay),
    });
    setDirection(delta);

    setCursor(({ year: y, month: m }) => {
      const next = m + delta;
      return next < 1 ? { year: y - 1, month: 12 } : next > 12 ? { year: y + 1, month: 1 } : { year: y, month: next };
    });

    animProgress.value = 0;
    titleProgress.value = 0;

    const duration = reduced ? 0 : 320;
    const easing = Easing.bezier(0.2, 0.9, 0.3, 1);

    animProgress.value = withTiming(1, { duration, easing }, (finished) => {
      if (finished) {
        runOnJS(clearOutgoing)();
      }
    });

    titleProgress.value = withTiming(1, { duration: Math.round(duration * 0.9), easing });
  };

  const incomingAnim = useAnimatedStyle(() => {
    if (!direction || reduced) return {};
    const t = animProgress.value;
    return {
      opacity: Math.min(1, t * 1.3),
      transform: [
        { translateX: (1 - t) * (direction * 70) },
        { scale: 0.98 + 0.02 * t },
      ],
    };
  });

  const outgoingAnim = useAnimatedStyle(() => {
    if (!direction || reduced) return { display: 'none' };
    const t = animProgress.value;
    return {
      opacity: Math.max(0, 1 - t * 1.3),
      transform: [
        { translateX: t * (-direction * 70) },
        { scale: 1 - 0.02 * t },
      ],
    };
  });

  const incomingTitleAnim = useAnimatedStyle(() => {
    if (!direction || reduced) return {};
    const t = titleProgress.value;
    return {
      opacity: t,
      transform: [{ translateX: (1 - t) * (direction * 22) }],
    };
  });

  const outgoingTitleAnim = useAnimatedStyle(() => {
    if (!direction || reduced) return { display: 'none' };
    const t = titleProgress.value;
    return {
      opacity: 1 - t,
      transform: [{ translateX: t * (-direction * 22) }],
    };
  });

  const gap = 6;
  const cell = Math.max(28, Math.floor((width - gap * 6) / 7));
  const tileH = Math.round(cell * 1.18); // a touch taller than wide, like the reference
  const monthEvents = [...byDay.values()].reduce((n, list) => n + list.length, 0);

  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  const gridH = rows * tileH + (rows - 1) * gap;

  return (
    <View
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, position: 'relative' }}>
          <Text style={styles.kicker}>Laundry activity</Text>
          <View style={styles.titleContainer}>
            {outgoing ? (
              <Animated.View style={[styles.titleOutgoing, outgoingTitleAnim]} pointerEvents="none">
                <Text style={styles.month} accessibilityRole="header">
                  {MONTHS[outgoing.month - 1]} <Text style={styles.year}>{outgoing.year}</Text>
                </Text>
              </Animated.View>
            ) : null}
            <Animated.View style={[styles.titleIncoming, incomingTitleAnim]}>
              <Text style={styles.month} accessibilityRole="header">
                {MONTHS[month - 1]} <Text style={styles.year}>{year}</Text>
              </Text>
            </Animated.View>
          </View>
        </View>
        <RoundNav icon="chevronLeft" label="Previous month" onPress={() => step(-1)} />
        <RoundNav icon="chevronRight" label="Next month" onPress={() => step(1)} />
      </View>

      <View style={[styles.weekdays, { gap }]}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.weekdayCol}>
            <Text style={styles.weekday} numberOfLines={1}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.carouselWrap, { minHeight: rows * tileH + (rows - 1) * gap, overflow: outgoing ? 'hidden' : 'visible' }]}>
        {outgoing ? (
          <Animated.View style={[styles.outgoingWrap, outgoingAnim]} pointerEvents="none">
            <MonthGrid
              year={outgoing.year}
              month={outgoing.month}
              today={today}
              selected={null}
              tileH={tileH}
              gap={gap}
              byDay={outgoing.byDay}
            />
          </Animated.View>
        ) : null}
        <Animated.View style={[styles.incomingWrap, incomingAnim]}>
          <MonthGrid
            year={year}
            month={month}
            today={today}
            selected={selected}
            tileH={tileH}
            gap={gap}
            byDay={byDay}
            onPressDay={(k, list, i) => {
              haptic.tap();
              onSelectDay?.(k, list);
              if (!renderDay) {
                setSelected(k);
                return;
              }
              // tapping the open date again closes its card; any other date moves the card there
              if (pop?.key === k && !leaving) {
                closePop();
                return;
              }
              setSelected(k);
              setLeaving(false);
              setPop({ key: k, index: i, events: list });
            }}
          />
          {renderDay && pop ? (
            <DayPopover
              key={pop.key}
              dayKey={pop.key}
              count={pop.events.length}
              index={pop.index}
              cell={cell}
              tileH={tileH}
              gap={gap}
              width={width}
              rows={rows}
              gridH={gridH}
              leaving={leaving}
              onClose={closePop}
              onGone={() => {
                setPop(null);
                setLeaving(false);
              }}
            >
              {renderDay(pop.key, pop.events, closePop)}
            </DayPopover>
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.foot}>
        <View style={styles.legend}>
          {LEGEND.map((l) => {
            const item = EVENT_LOOK[l.type];
            return (
              <View key={l.type} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: item.tile, borderColor: item.border }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            );
          })}
        </View>
        {!events.loading && monthEvents === 0 ? <Text style={styles.quiet}>No laundry activity this month.</Text> : null}
      </View>
    </View>
  );
}

/**
 * The date card: a small white card with a pointer at the tapped date. It sits under the date in the top half of
 * the month and over it in the bottom half, eases out of the date when it opens, and back into it when it closes.
 */
function DayPopover({
  dayKey: key,
  count,
  index,
  cell,
  tileH,
  gap,
  width,
  rows,
  gridH,
  leaving,
  onClose,
  onGone,
  children,
}: {
  dayKey: string;
  count: number;
  index: number;
  cell: number;
  tileH: number;
  gap: number;
  width: number;
  rows: number;
  gridH: number;
  leaving: boolean;
  onClose: () => void;
  onGone: () => void;
  children: React.ReactNode;
}) {
  const row = Math.floor(index / 7);
  const col = index % 7;
  // Wherever there is more place:
  // Row 0 has all other rows below it -> opens downward.
  // Rows >= 1 have ample space above and opening above prevents collision with the floating bottom bar.
  const above = row >= 1;
  const pointerX = Math.min(width - 36, Math.max(36, col * (cell + gap) + cell / 2));
  const place = above ? { bottom: gridH - row * (tileH + gap) + 8 } : { top: (row + 1) * (tileH + gap) - gap + 8 };

  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (leaving) {
      t.set(withTiming(0, { duration: reduced ? 0 : 160, easing: Easing.in(Easing.quad) }));
      const id = setTimeout(onGone, reduced ? 0 : 170);
      return () => clearTimeout(id);
    }
    t.set(withTiming(1, { duration: reduced ? 0 : 260, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, reduced, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * (above ? 8 : -8) }, { scale: 0.92 + 0.08 * t.value }],
  }));

  const [y, m, d] = key.split('-').map(Number);
  const weekday = WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
  const title = `${weekday}, ${d} ${MONTHS[m - 1]}`;

  return (
    <Animated.View
      style={[styles.pop, place, { transformOrigin: [pointerX, above ? '100%' : '0%', 0] }, anim]}
      accessibilityViewIsModal={false}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.popPointer, above ? styles.popPointerDown : styles.popPointerUp, { left: pointerX - 7 }]} />
      <View style={styles.popHead}>
        <Text style={styles.popTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {count > 1 ? <Text style={styles.popCount}>{count} updates</Text> : null}
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={({ pressed }) => [styles.popClose, webCursor, pressed && { opacity: 0.6 }]}>
          <Icon name="x" size={14} color={colors.inkSoft} strokeWidth={2.4} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 248 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

function RoundNav({ icon, label, onPress }: { icon: 'chevronLeft' | 'chevronRight'; label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 15, stiffness: 350 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 280 });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={webCursor}
    >
      <Animated.View style={[styles.nav, anim]}>
        <Icon name={icon} size={18} color={colors.ink} />
      </Animated.View>
    </Pressable>
  );
}

/** Pure grid renderer for a given month's dates and laundry event tiles */
function MonthGrid({
  year,
  month,
  today,
  selected,
  tileH,
  gap,
  byDay,
  onPressDay,
}: {
  year: number;
  month: number;
  today: string;
  selected: string | null;
  tileH: number;
  gap: number;
  byDay: Map<string, LaundryEventDetail[]>;
  onPressDay?: (k: string, list: LaundryEventDetail[], index: number) => void;
}) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  // Group into strict 7-day week rows so no row can ever wrap at 6 days on any screen size
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.grid}>
      {weeks.map((week, weekIndex) => (
        <View
          key={`week-${weekIndex}`}
          style={[
            styles.weekRow,
            { gap, marginBottom: weekIndex === weeks.length - 1 ? 0 : gap },
          ]}
        >
          {week.map((d, colIndex) => {
            const index = weekIndex * 7 + colIndex;
            if (d === null) {
              return <View key={`b-${index}`} style={[styles.cellWrap, { height: tileH }]} />;
            }
            const k = `${prefix}${String(d).padStart(2, '0')}`;
            const list = byDay.get(k) ?? [];
            return (
              <View key={k} style={[styles.cellWrap, { height: tileH }]}>
                <DayCell
                  day={d}
                  height={tileH}
                  events={list}
                  isToday={k === today}
                  isPast={k < today}
                  isSelected={k === selected}
                  onPress={() => onPressDay?.(k, list, index)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  height,
  events,
  isToday,
  isPast,
  isSelected,
  onPress,
}: {
  day: number;
  height: number;
  events: LaundryEventDetail[];
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const sel = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    sel.value = withSpring(isSelected ? 1 : 0, { damping: 15, stiffness: 280 });
  }, [sel, isSelected]);

  const cellAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const ringAnim = useAnimatedStyle(() => ({
    opacity: sel.value,
    transform: [{ scale: 0.85 + 0.15 * sel.value }],
  }));

  const lead = TILE_ORDER.find((t) => events.some((e) => e.type === t));
  const look = lead ? EVENT_LOOK[lead] : null;

  const tile = look
    ? [styles.tile, { backgroundColor: look.tile, borderWidth: 1.25, borderColor: look.border }]
    : isToday
      ? [styles.tile, styles.today]
      : isPast
        ? [styles.tile, styles.tilePast]
        : [styles.tile, styles.tileAhead];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressScale.set(withSpring(0.92, { damping: 14, stiffness: 320 }))}
      onPressOut={() => pressScale.set(withSpring(1, { damping: 12, stiffness: 240 }))}
      accessibilityRole="button"
      accessibilityLabel={`${day}${isToday ? ', today' : ''}${events.length ? `, ${events.length} laundry ${events.length === 1 ? 'event' : 'events'}` : ''}`}
      style={[{ width: '100%', height }, webCursor]}
    >
      <Animated.View style={[tile, { width: '100%', height }, cellAnim]}>
        {look ? (
          <View style={styles.badge}>
            <Icon name={look.icon} size={7} color={look.color} strokeWidth={2.4} />
          </View>
        ) : null}
        <Text
          style={[
            styles.dayText,
            isToday && !look && styles.todayText,
            look && [styles.dayTextStrong, { color: look.textColor }],
            !look && !isPast && !isToday && styles.dayTextAhead,
          ]}
        >
          {day}
        </Text>
        {isToday && look ? <View style={styles.todayMark} /> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.selRing, ringAnim]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(10, 28, 62, 0.72)' },
  titleContainer: { position: 'relative', minHeight: 30, justifyContent: 'center', overflow: 'hidden' },
  titleOutgoing: { position: 'absolute', left: 0, top: 0, right: 0 },
  titleIncoming: { position: 'relative' },
  month: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: '#0A1C3E', marginTop: 1 },
  year: { fontFamily: fonts.semibold, color: 'rgba(10, 28, 62, 0.72)' },
  nav: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255, 255, 255, 0.65)', borderWidth: 1.25, borderColor: 'rgba(255, 255, 255, 0.85)', alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: space.sm },
  weekdayCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(10, 28, 62, 0.75)', textAlign: 'center' },
  carouselWrap: { position: 'relative', overflow: 'hidden', zIndex: 5 },
  outgoingWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  incomingWrap: { position: 'relative', zIndex: 2 },
  grid: { flexDirection: 'column', width: '100%' },
  weekRow: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  cellWrap: { flex: 1 },
  tile: { flex: 1, borderRadius: 12, padding: 6, justifyContent: 'flex-end', alignItems: 'flex-start' },
  tilePast: { backgroundColor: '#FFFFFF', borderWidth: 1.25, borderColor: 'rgba(255, 255, 255, 0.9)' },
  tileAhead: { backgroundColor: 'rgba(255, 255, 255, 0.45)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.65)' },
  today: { backgroundColor: '#0A1C3E', borderWidth: 1.25, borderColor: '#0A1C3E' },
  badge: {
    position: 'absolute',
    top: 3.5,
    right: 3.5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(60, 45, 20, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16, color: '#0A1C3E' },
  dayTextStrong: { fontFamily: fonts.bold },
  dayTextAhead: { color: 'rgba(10, 28, 62, 0.55)', fontFamily: fonts.medium },
  todayText: { color: '#FFFFFF', fontFamily: fonts.bold },
  todayMark: { position: 'absolute', right: 6, bottom: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#0A1C3E' },
  selRing: { borderRadius: 12, borderWidth: 2.5, borderColor: '#0A1C3E' },
  swatch: { width: 10, height: 10, borderRadius: 3, borderWidth: 1.25 },
  gridWrap: { position: 'relative', zIndex: 5 },
  pop: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8E4DA',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 16px 36px rgba(40, 30, 10, 0.14), 0 2px 8px rgba(40, 30, 10, 0.06)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 26, elevation: 14 }),
  },
  popPointer: { position: 'absolute', width: 14, height: 14, backgroundColor: '#FFFFFF', borderColor: '#E8E4DA', transform: [{ rotate: '45deg' }] },
  popPointerUp: { top: -8, borderTopWidth: 1, borderLeftWidth: 1, borderTopLeftRadius: 3 },
  popPointerDown: { bottom: -8, borderBottomWidth: 1, borderRightWidth: 1, borderBottomRightRadius: 3 },
  popHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 28, marginBottom: 4 },
  popTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.2, color: colors.ink },
  popCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  popClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F4F2EE', alignItems: 'center', justifyContent: 'center' },
  foot: { marginTop: space.md, gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: fonts.semibold, fontSize: 11, color: '#0A1C3E' },
  quiet: { fontFamily: fonts.medium, fontSize: 12.5, color: '#6E6659' },
});
