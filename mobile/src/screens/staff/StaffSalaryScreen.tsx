import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '../../components/app/Icon';
import { Rise, RollingNumber } from '../../components/app/motion';
import { TopBar } from '../../components/app/TopBar';
import { Button } from '../../components/app/primitives';
import { EmptyState, Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { haptic } from '../../lib/haptics';
import { date, money } from '../../lib/format';
import { useWebDrag } from '../../lib/useWebDrag';
import type { ScreenProps } from '../../navigation/types';
import { PAY_DAY_NOTE, payrollFor, profileWithEdits, type Payroll, type SalaryStatement } from '../../staff/workforce';
import { app, colors, fonts, space, text } from '../../theme';
import { useStaff } from './kit';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const SHEET_ID = 'salary-statements-sheet';
const NAVY = colors.navy;
const CANVAS = '#EAE6DB'; // the wallet's stone beige
const GREEN = '#0D7A21';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (m: string) => MONTHS[Number(m.slice(5)) - 1] ?? m;
const shortMonth = (m: string) => `${monthOf(m).slice(0, 3)} ${m.slice(0, 4)}`;
const paidDate = (d: string) => date(`${d}T00:00:00`);

/**
 * My salary, laid out like the customer Wallet: the two stacked cards up top (last net pay on the yellow card), the
 * statements in a white sheet that rises over them, and the latest payslip button fixed at the bottom. It shows the
 * signed-in person's own pay record only.
 */
export function StaffSalaryScreen({ navigation }: ScreenProps<'StaffSalary'>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const { me, wf, unread } = useStaff();
  const st = me?.staff;
  const pay = st ? payrollFor(st.id) : undefined; // own record only
  const profile = wf && st ? profileWithEdits(wf, st.id) : undefined;
  const statements = pay?.statements ?? [];
  const latest = statements.find((s) => s.status === 'PAID') ?? statements[0];

  const [open, setOpen] = useState<SalaryStatement | null>(null);
  const [structure, setStructure] = useState(false);
  const [heroH, setHeroH] = useState(0);

  /* ── the statements sheet, exactly as the wallet's transactions sheet ── */
  const lift = Math.round(Math.max(0, heroH - insets.top - 64) * 0.75);
  const pos = useSharedValue(0);
  const startPos = useSharedValue(0);
  const [isRaised, setIsRaised] = useState(false);
  const settle = (to: number) => {
    setIsRaised(to > 0.5);
    pos.set(withSpring(to, { damping: 22, stiffness: 240, mass: 0.8 }));
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => startPos.set(pos.value),
        onPanResponderMove: (_, g) => {
          const p = startPos.value - g.dy / Math.max(lift, 1);
          pos.set(p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p);
        },
        onPanResponderRelease: (_, g) => settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.value > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos],
  );
  useWebDrag(
    'salary-handle',
    {
      onStart: () => startPos.set(pos.value),
      onMove: (dy) => {
        const v = startPos.value - dy / Math.max(lift, 1);
        pos.set(v < 0 ? v * 0.25 : v > 1 ? 1 + (v - 1) * 0.25 : v);
      },
      onEnd: (vy) => settle(vy < -0.3 ? 1 : vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
    },
    [heroH, lift],
  );
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pos.value * lift }] }));
  const listInset = useAnimatedStyle(() => ({ marginBottom: (1 - Math.min(1, Math.max(0, pos.value))) * lift }));
  const heroStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: 1 - t * 0.2, transform: [{ scale: 1 - t * 0.04 }] };
  });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, pos.value)) * 0.52 }));
  const toggle = () => {
    haptic.tap();
    settle(pos.value > 0.5 ? 0 : 1);
  };
  const bottomGap = Math.max(insets.bottom, 12) + 4; // no tab bar on this page
  const listY = useRef(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroH, lift]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.page, { paddingTop: Math.max(insets.top, 6) }, heroStyle]} onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}>
        <Rise distance={8}>
          <TopBar
            padded={false}
            title="Salary"
            onHome={() => navigation.navigate('StaffTabs', { screen: 'StaffHome' })}
            unread={unread}
            onBell={() => navigation.navigate('StaffNotifications')}
          />
        </Rise>

        {!me || !st ? (
          <View style={styles.cardsWrap}>
            <Skeleton height={compact ? 174 : 188} radius={24} />
          </View>
        ) : !pay ? (
          <EmptyState icon="wallet" title="Pay details not set up yet" message="HR adds them after your first month." />
        ) : (
          <PayCards
            net={latest?.net ?? 0}
            label={latest ? `${shortMonth(latest.month)} net pay` : 'Net pay'}
            gross={pay.salary.monthlyGross}
            name={st.name}
            employeeId={profile?.employeeId ?? st.id}
            joined={st.joinedAt}
            compact={compact}
            onHistory={toggle}
            onStructure={() => setStructure(true)}
          />
        )}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents={isRaised ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => settle(0)} accessibilityRole="button" accessibilityLabel="Dismiss statements" />
      </Animated.View>

      {heroH && pay ? (
        <Animated.View nativeID={SHEET_ID} style={[styles.sheet, { top: heroH + space.md, bottom: -lift }, sheetStyle]}>
          <View nativeID="salary-handle" {...pan.panHandlers}>
            <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Show more or fewer statements" hitSlop={10} style={[styles.handleHit, webCursor]}>
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Salary credits</Text>
              <Text style={styles.sheetCount}>{statements.length}</Text>
            </View>
          </View>
          <Animated.View style={[styles.fill, listInset]}>
            <ScrollView
              style={styles.fill}
              onScroll={(e) => (listY.current = e.nativeEvent.contentOffset.y)}
              onScrollBeginDrag={() => pos.value < 0.5 && settle(1)}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y <= 0 && pos.value > 0.5 && (e.nativeEvent.velocity?.y ?? 0) < -0.2) settle(0);
              }}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: bottomGap + 88 }}
              showsVerticalScrollIndicator={false}
            >
              {statements.length ? (
                <>
                  <StatementList items={statements} onOpen={setOpen} />
                  <Rise delay={260 + (statements.length + 3) * 60} distance={6} style={styles.end}>
                    <Text style={styles.endText}>Demo figures · {PAY_DAY_NOTE}</Text>
                  </Rise>
                </>
              ) : (
                <EmptyState icon="wallet" title="No salary credits yet" message="Your monthly pay will show up here." />
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* latest payslip stays put at the bottom, like Top Up */}
      <View style={[styles.bottom, { paddingBottom: bottomGap }]} pointerEvents="box-none">
        <View style={styles.bottomFade} pointerEvents="none" />
        <Rise delay={160} distance={24}>
          <Button label="View latest payslip" variant="dark" icon="receipt" disabled={!latest} onPress={() => latest && setOpen(latest)} style={styles.cta} />
        </Rise>
      </View>

      <BottomSheet visible={!!open || structure} onClose={() => (setOpen(null), setStructure(false))}>
        {open ? <Payslip s={open} /> : structure && pay ? <Structure pay={pay} /> : null}
      </BottomSheet>
    </View>
  );
}

/* ───────────── the two stacked cards, as on the wallet ───────────── */

const FRONT = { radius: 24, notchW: 116, notchH: 48, gap: 6 };

function frontPath(w: number, h: number) {
  const { radius: r, notchW: nw, notchH: nh, gap } = FRONT;
  const pill = (nh - gap) / 2;
  const ring = pill + gap;
  const tail = Math.min(r, nh - ring);
  const x = w - nw;
  const y = h - nh;
  return [
    `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}`,
    `V${y - ring}A${ring} ${ring} 0 0 1 ${w - ring} ${y}`,
    `H${x + ring}A${ring} ${ring} 0 0 0 ${x} ${y + ring}`,
    `V${h - tail}A${tail} ${tail} 0 0 1 ${x - tail} ${h}`,
    `H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`,
  ].join('');
}

function PayCards({
  net,
  label,
  gross,
  name,
  employeeId,
  joined,
  compact,
  onHistory,
  onStructure,
}: {
  net: number;
  label: string;
  gross: number;
  name: string;
  employeeId: string;
  joined: string;
  compact: boolean;
  onHistory: () => void;
  onStructure: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const [w, setW] = useState(Math.round(screenW - space.lg * 2));
  const reduced = useReducedMotion();
  const front = useSharedValue(reduced ? 1 : 0);
  const back = useSharedValue(reduced ? 1 : 0);
  const focused = useIsFocused();
  useEffect(() => {
    if (reduced || !focused) return;
    front.set(0);
    back.set(0);
    front.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    back.set(withDelay(380, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) })));
  }, [front, back, reduced, focused]);
  const frontStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, front.value * 1.6), transform: [{ translateY: (1 - front.value) * 34 }, { scale: 0.96 + 0.04 * front.value }] }));
  const backStyle = useAnimatedStyle(() => ({ opacity: back.value > 0 ? 1 : 0, transform: [{ translateY: (1 - back.value) * 64 }] }));

  const len = money(net).length;
  const size = Math.round((len <= 6 ? 34 : len <= 8 ? 30 : 26) * (compact ? 0.92 : 1));
  const h = compact ? 174 : 188;
  const since = `${joined.slice(5, 7)}/${joined.slice(2, 4)}`;

  return (
    <View style={styles.cardsWrap}>
      {/* navy card behind: the monthly gross, opens the salary structure */}
      <Animated.View style={backStyle}>
        <Pressable onPress={onStructure} accessibilityRole="button" accessibilityLabel={`Monthly gross ${money(gross)}, open salary structure`} style={({ pressed }) => [styles.backCard, webCursor, pressed && { opacity: 0.92 }]}>
          <View style={styles.backLeft}>
            <View style={styles.backIcon}>
              <Icon name="list" size={13} color={NAVY} strokeWidth={2.4} />
            </View>
            <Text style={styles.backTitle}>Monthly gross</Text>
          </View>
          <View style={styles.backLeft}>
            <Text style={styles.backNumber}>{money(gross)}</Text>
            <Icon name="chevronRight" size={16} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </Pressable>
      </Animated.View>

      {/* the yellow card with the notch */}
      <Animated.View style={[{ height: h, marginTop: -24 }, frontStyle]}>
        <View style={styles.frontShape} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} pointerEvents="none">
          {w ? (
            <Svg width={w} height={h}>
              <Path d={frontPath(w, h)} fill={app.yellow} />
            </Svg>
          ) : null}
        </View>

        <View style={[styles.frontBody, { height: h - FRONT.notchH }]}>
          <View style={styles.frontRow}>
            <View style={styles.frontIcon}>
              <Icon name="wallet" size={15} color={app.yellow} strokeWidth={2.2} />
            </View>
            <Text style={styles.frontNumber}>{employeeId}</Text>
          </View>
          <View style={styles.frontMid}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.frontLabel, { marginBottom: 2 }]}>{label}</Text>
              <RollingNumber value={net} style={{ ...styles.frontBalance, fontSize: size, lineHeight: Math.round(size * 1.18) }} delay={300} />
            </View>
            <View style={styles.frontSide}>
              <Text style={styles.frontLabel}>Joined</Text>
              <Text style={styles.frontSideValue}>{since}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.frontName, { right: FRONT.notchW + 12, height: FRONT.notchH }]}>
          <Text style={styles.frontLabel}>Name</Text>
          <Text style={styles.frontNameText} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <Pressable
          onPress={onHistory}
          accessibilityRole="button"
          accessibilityLabel="Show all salary credits"
          style={({ pressed }) => [styles.notchPill, { width: FRONT.notchW - FRONT.gap, height: FRONT.notchH - FRONT.gap }, webCursor, pressed && { opacity: 0.88 }]}
        >
          <View style={styles.notchIcon}>
            <Icon name="receipt" size={14} color="#0A1C3E" strokeWidth={2.2} />
          </View>
          <Text style={styles.notchText}>History</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ───────────── the list, grouped by year like the wallet's months ───────────── */

function StatementList({ items, onOpen }: { items: SalaryStatement[]; onOpen: (s: SalaryStatement) => void }) {
  const groups: { label: string; items: { s: SalaryStatement; index: number }[] }[] = [];
  items.forEach((s, index) => {
    const label = s.month.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push({ s, index });
    else groups.push({ label, items: [{ s, index }] });
  });
  const delay = 260;
  const step = 60;
  return (
    <>
      {groups.map((g, gi) => (
        <View key={g.label}>
          <Rise delay={delay + (g.items[0].index + gi) * step} distance={6} style={[styles.groupHead, gi === 0 && { marginTop: space.sm }]}>
            <Text style={styles.groupLabel} accessibilityRole="header">
              {g.label}
            </Text>
          </Rise>
          {g.items.map(({ s, index }, i) => {
            const paid = s.status === 'PAID';
            const sub = paid && s.paidOn ? `Paid ${paidDate(s.paidOn)}` : 'Being processed';
            return (
              <Rise key={s.id} delay={delay + (index + gi + 1) * step} distance={10} style={i > 0 && styles.txnDivider}>
                <Pressable onPress={() => onOpen(s)} accessibilityRole="button" accessibilityLabel={`${monthOf(s.month)} salary, ${money(s.net)}, ${sub}`} style={({ pressed }) => [styles.txn, webCursor, pressed && { opacity: 0.7 }]}>
                  <View style={[styles.txnIcon, { backgroundColor: paid ? colors.successTint : app.warningTint }]}>
                    <Icon name={paid ? 'wallet' : 'clock'} size={16} color={paid ? GREEN : app.warning} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.txnTitle} numberOfLines={1}>
                      {monthOf(s.month)} salary
                    </Text>
                    <Text style={styles.when} numberOfLines={1}>
                      {sub}
                    </Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color: paid ? GREEN : colors.ink }]}>+{money(s.net)}</Text>
                    {!paid ? (
                      <View style={styles.pending}>
                        <View style={styles.pendingDot} />
                        <Text style={styles.pendingText}>Pending</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </Rise>
            );
          })}
        </View>
      ))}
    </>
  );
}

/* ───────────── drawers, like the wallet's Top Up ───────────── */

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: 'plus' | 'minus'; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong, tone === 'plus' && { color: GREEN }, tone === 'minus' && { color: colors.inkSoft }]}>{value}</Text>
    </View>
  );
}

function Payslip({ s }: { s: SalaryStatement }) {
  const deductions = s.deductions.reduce((n, d) => n + d.amount, 0);
  const paid = s.status === 'PAID';
  return (
    <View>
      <Text style={text.h1}>{monthOf(s.month)} payslip</Text>
      <Text style={[text.body, { marginTop: 2 }]}>{paid && s.paidOn ? `Paid ${paidDate(s.paidOn)} · Ref ${s.reference}` : 'Being processed'}</Text>

      <View style={styles.box}>
        <Row label="Days paid" value={`${s.daysPayable} of ${s.daysInMonth}`} />
        {s.lossOfPayDays ? <Row label="Unpaid days" value={String(s.lossOfPayDays)} /> : null}
        <View style={styles.rule} />
        <Row label="Earned pay" value={money(s.earnedBase)} />
        {s.incentives.map((x) => (
          <Row key={x.label} label={x.label} value={`+${money(x.amount)}`} tone="plus" />
        ))}
        {s.deductions.map((x) => (
          <Row key={x.label} label={x.label} value={`−${money(x.amount)}`} tone="minus" />
        ))}
        <View style={styles.rule} />
        <Row label="Gross" value={money(s.gross)} />
        <Row label="Deductions" value={`−${money(deductions)}`} tone="minus" />
      </View>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={text.label}>Net pay</Text>
          <Text style={text.caption}>Demo figures</Text>
        </View>
        <RollingNumber value={s.net} style={styles.summaryAmount} />
      </View>
    </View>
  );
}

function Structure({ pay }: { pay: Payroll }) {
  return (
    <View>
      <Text style={text.h1}>Salary structure</Text>
      <Text style={[text.body, { marginTop: 2 }]}>From {paidDate(pay.salary.effectiveFrom)} · {PAY_DAY_NOTE}</Text>
      <View style={styles.box}>
        {pay.salary.components.map((c) => (
          <Row key={c.label} label={c.label} value={money(c.amount)} />
        ))}
      </View>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={text.label}>Monthly gross</Text>
          <Text style={text.caption}>Before deductions</Text>
        </View>
        <Text style={styles.summaryAmount}>{money(pay.salary.monthlyGross)}</Text>
      </View>
    </View>
  );
}

const shadow = (web: string, native: object) => (Platform.OS === 'web' ? ({ boxShadow: web } as object) : native);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CANVAS },
  page: { paddingHorizontal: space.lg },
  fill: { flex: 1 },
  backdrop: { backgroundColor: '#181410' },
  barBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E4DA', alignItems: 'center', justifyContent: 'center' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DA',
    ...shadow('0 -4px 16px rgba(0, 0, 0, 0.04), 0 -1px 3px rgba(0, 0, 0, 0.02)', { shadowColor: '#000000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 4 }),
  },
  handleHit: { alignSelf: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.sm },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  sheetCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft, backgroundColor: '#F1EFEA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xxl },
  bottomFade: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === 'web' ? ({ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF 45%)' } as object) : { backgroundColor: 'rgba(255,255,255,0.92)' }),
  },
  cta: shadow('0 4px 12px rgba(10, 28, 62, 0.12), 0 1px 3px rgba(10, 28, 62, 0.06)', { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 }),

  cardsWrap: { marginTop: space.md },
  backCard: {
    height: 68,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: 12,
    ...shadow('0 4px 12px rgba(1, 42, 92, 0.08)', { shadowColor: NAVY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  backIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backTitle: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFFFFF' },
  backNumber: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.4, color: '#FFFFFF', lineHeight: 24, fontVariant: ['tabular-nums'] },
  frontShape: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0 4px 10px rgba(60, 45, 20, 0.06))' } as object) : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }),
  },
  frontBody: { paddingHorizontal: space.xl, paddingTop: 18 },
  frontRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  frontIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0A1C3E', alignItems: 'center', justifyContent: 'center' },
  frontNumber: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 1.2, color: '#0A1C3E' },
  frontMid: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 'auto', paddingBottom: 6 },
  frontLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(10, 28, 62, 0.66)' },
  frontBalance: { fontFamily: fonts.bold, letterSpacing: -1, color: '#0A1C3E', fontVariant: ['tabular-nums'] },
  frontSide: { alignItems: 'flex-end', paddingBottom: 6 },
  frontSideValue: { fontFamily: fonts.semibold, fontSize: 15, color: '#0A1C3E', marginTop: 2, fontVariant: ['tabular-nums'] },
  frontName: { position: 'absolute', left: space.xl, bottom: 0, justifyContent: 'center' },
  frontNameText: { fontFamily: fonts.semibold, fontSize: 14.5, color: '#0A1C3E', marginTop: 2 },
  notchPill: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 7,
    borderRadius: (FRONT.notchH - FRONT.gap) / 2,
    backgroundColor: '#0A1C3E',
    ...shadow('0 3px 8px rgba(10, 28, 62, 0.08)', { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }),
  },
  notchIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  notchText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFFFFF' },

  groupHead: { marginTop: space.lg, marginBottom: 4 },
  groupLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkMuted },
  end: { alignItems: 'center', justifyContent: 'center', marginTop: space.xl, paddingBottom: space.md },
  endText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.4, color: colors.inkMuted, opacity: 0.7, textAlign: 'center' },
  txn: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  txnDivider: { borderTopWidth: 1, borderTopColor: '#F2EFEB' },
  txnIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  txnTitle: { fontFamily: fonts.semibold, fontSize: 14.5, letterSpacing: -0.2, color: colors.ink },
  when: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { fontFamily: fonts.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 19, paddingHorizontal: 7, borderRadius: 10, backgroundColor: app.warningTint },
  pendingDot: { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: app.warning },
  pendingText: { fontFamily: fonts.semibold, fontSize: 10.5, color: app.warning },

  box: { marginTop: space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 18, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E8E4DA' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, paddingVertical: 7 },
  rowLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  rowStrong: { fontFamily: fonts.semibold, color: colors.ink },
  rule: { height: 1, backgroundColor: '#E8E4DA', marginVertical: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: 18, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#C4BEAD' },
  summaryAmount: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] },
});
