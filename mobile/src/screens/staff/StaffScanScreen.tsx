import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../components/app/Icon';
import { Pop, Rise } from '../../components/app/motion';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillField, PillTextArea } from '../../components/ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { useWebDrag } from '../../lib/useWebDrag';
import { ago, date, money, plural, when } from '../../lib/format';
import { MODE_COPY, QR_PURPOSE_COPY, STATUS_COPY } from '../../mock/engine/lifecycle';
import { findCustomer, findOrder, findReceipt } from '../../mock/engine/selectors';
import { scan, type ScanResult } from '../../mock/services/qrService';
import { acceptOrder, rejectOrder } from '../../mock/services/staffService';
import type { StaffTabProps } from '../../navigation/types';
import { can, canSeeContact, displayName } from '../../staff/work';
import { colors, fonts, space } from '../../theme';
import { TopBar } from '../../components/app/TopBar';
import { ScannerModal } from './ScannerModal';
import { BEIGE, BG, Button, CHIP, RADIUS, RULE, shared, TAB_ROOM, Tag, useStaff, webCursor } from './kit';

type Refusal = Extract<ScanResult, { ok: false }>;
type ScanRow = { key: string; ok: boolean; title: string; meta: string; at: string; orderId?: string };
const SHEET_ID = 'staff-scans-sheet';
const HERO = '#FED843'; // the customer order page's QR card
const NAVY = '#0A1C3E';
const GREEN = '#0D7A21';
const REASONS = ['Item counts don’t match the order', 'Items need a service we don’t offer here', 'Damaged items the customer didn’t mention', 'Customer asked to cancel'];

const NOW_MS = Date.now();
const MOCK_SCAN_ROWS: ScanRow[] = [
  {
    key: 'mock-1',
    ok: true,
    title: 'WB-1014 · Aarav Mehta',
    meta: 'Drop-off at counter · 5 pcs · Awaiting acceptance',
    at: new Date(NOW_MS - 12 * 60 * 1000).toISOString(),
    orderId: 'WB-1014',
  },
  {
    key: 'mock-2',
    ok: true,
    title: 'WB-1011 · Priya Patel',
    meta: 'Drop-off at counter · 4 pcs · Awaiting acceptance',
    at: new Date(NOW_MS - 35 * 60 * 1000).toISOString(),
    orderId: 'WB-1011',
  },
  {
    key: 'mock-3',
    ok: true,
    title: 'WB-1008 · Rohan Verma',
    meta: 'Drop-off at counter · 6 pcs · Awaiting acceptance',
    at: new Date(NOW_MS - 75 * 60 * 1000).toISOString(),
    orderId: 'WB-1008',
  },
  {
    key: 'mock-4',
    ok: true,
    title: 'WB-1003 · Sneha Reddy',
    meta: 'Home pickup · 7 pcs · Awaiting acceptance',
    at: new Date(NOW_MS - 140 * 60 * 1000).toISOString(),
    orderId: 'WB-1003',
  },
];

/** What each refusal looks like: a clear title and icon for the most common cases. */
const REFUSAL: Record<string, { title: string; icon: IconName }> = {
  NOT_WB_QR: { title: 'Not a Washing Basket QR', icon: 'x' },
  UNKNOWN_QR: { title: 'Code not recognised', icon: 'x' },
  QR_EXPIRED: { title: 'QR has expired', icon: 'clock' },
  QR_USED: { title: 'QR already used', icon: 'check' },
  QR_REVOKED: { title: 'Old QR code', icon: 'refresh' },
  QR_LOCKED: { title: 'Payment not completed', icon: 'lock' },
  NOT_PAID: { title: 'Payment not completed', icon: 'lock' },
  WRONG_LOCATION: { title: 'Wrong branch', icon: 'mapPin' },
  WRONG_ORDER: { title: 'Different order', icon: 'alert' },
  WRONG_PURPOSE: { title: 'Wrong kind of QR', icon: 'alert' },
  NOT_VERIFIED: { title: 'Customer hasn’t checked yet', icon: 'shirt' },
  BAD_STATE: { title: 'Not at this step', icon: 'info' },
  STAFF_INACTIVE: { title: 'Account paused', icon: 'lock' },
};

/**
 * The scanner, laid out like the customer's order page. The yellow card opens the camera over the whole screen; a
 * valid drop-off or pickup QR brings that order up right here to count and accept or reject, and every scan I make
 * is listed underneath. The QR holds only a random reference: the order system checks it and has the final say.
 */
export function StaffScanScreen({ navigation, route }: StaffTabProps<'StaffScan'>) {
  const intent = route.params?.intent ?? 'ANY';
  const expectOrderId = route.params?.orderId;
  const nonce = route.params?.nonce;
  const { state, me, unread } = useStaff();

  const [camera, setCamera] = useState(false);
  const [checking, setChecking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [scanned, setScanned] = useState<{ orderId: string; qrId: string } | null>(null);
  const [counted, setCounted] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'accepted' | 'rejected' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const pending = useRef(false);

  // a new visit (from the tab bar or an order) starts clean
  const visit = `${nonce}|${expectOrderId}|${intent}`;
  const [seenVisit, setSeenVisit] = useState(visit);
  if (visit !== seenVisit) {
    setSeenVisit(visit);
    setRefusal(null);
    setScanned(null);
    setOutcome(null);
    setLookupError(null);
    setCode('');
    setOrderDrawerOpen(false);
  }

  const scans = !!me && (can(me.staff, 'ORDER_ACCEPT') || can(me.staff, 'DELIVERY_CONFIRM'));

  const check = useCallback(
    async (raw: string) => {
      if (!me || pending.current) return;
      pending.current = true;
      setChecking(true);
      setRefusal(null);
      setLookupError(null);
      // a finished order makes way for the next scan; one still waiting for accept or reject stays
      if (outcome) {
        setScanned(null);
        setOutcome(null);
      }
      try {
        const r = await scan(raw, me.staff.id, intent, expectOrderId);
        if (r.ok) {
          haptic.success();
          setCode('');
          if (r.kind === 'INTAKE') {
            // the order comes up right here, to count and accept
            setScanned({ orderId: r.orderId, qrId: r.qrId });
            setCounted(false);
            setOutcome(null);
            setActionError(null);
            setReason('');
            setOrderDrawerOpen(true);
          } else {
            navigation.navigate('StaffDelivery', { orderId: r.orderId, qrId: r.qrId });
          }
        } else {
          haptic.error();
          setRefusal(r);
        }
      } catch (e) {
        haptic.error();
        setRefusal({ ok: false, code: 'ERROR', reason: e instanceof Error ? e.message : 'Couldn’t check this code. Check your connection and try again.' });
      } finally {
        pending.current = false;
        setChecking(false);
      }
    },
    [me, intent, expectOrderId, navigation, outcome],
  );

  const openCamera = () => {
    haptic.tap();
    setRefusal(null);
    setCamera(true);
  };

  const reset = () => {
    haptic.tap();
    setScanned(null);
    setOutcome(null);
    setCounted(false);
    setActionError(null);
    setRefusal(null);
    setOrderDrawerOpen(false);
  };

  const openScanOrder = (orderId: string) => {
    haptic.tap();
    const ord = state?.orders.find((o) => o.id === orderId);
    if (!ord) return;
    setRefusal(null);
    setCounted(false);
    setActionError(null);
    if (ord.status === 'ACCEPTED') {
      setOutcome('accepted');
    } else if (ord.status === 'REJECTED') {
      setOutcome('rejected');
    } else {
      setOutcome(null);
    }
    setScanned({ orderId, qrId: ord.intakeQrId ?? `qr-${orderId.toLowerCase()}` });
    setOrderDrawerOpen(true);
  };

  /** The box takes the code printed under the QR, or an order number to look the order up. */
  const submit = () => {
    const t = code.trim().toUpperCase();
    if (/^WB-?\d{3,6}$/.test(t)) {
      const id = t.includes('-') ? t : `WB-${t.slice(2)}`;
      const order = state?.orders.find((o) => o.id === id);
      if (!order) return setLookupError(`No order ${id}.`);
      if (order.locationId !== me?.location.id) return setLookupError(`${id} belongs to another branch.`);
      setLookupError(null);
      setCode('');
      setManualOpen(false);
      openScanOrder(id);
      return;
    }
    setManualOpen(false);
    check(t);
  };
  const valid = /^WB-?\d{3,6}$/i.test(code.trim()) || code.replace(/-/g, '').length === 10;

  /* ── the scanned order ── */
  const order = state && scanned ? findOrder(state, scanned.orderId) : undefined;
  const customer = state && order ? findCustomer(state, order.customerId) : undefined;
  const contact = !!me && !!order && canSeeContact(me.staff, order);
  const name = displayName(customer?.name ?? 'Customer', contact);
  const isHome = order?.serviceMode === 'HOME_PICKUP';
  const receipt = state && order ? findReceipt(state, order.id) : undefined;

  const accept = async () => {
    if (!me || !order || !scanned || busy) return;
    setBusy('accept');
    setActionError(null);
    try {
      await acceptOrder(order.id, me.staff.id, scanned.qrId);
      haptic.success();
      setOutcome('accepted');
    } catch (e) {
      haptic.error();
      setActionError(e instanceof Error ? e.message : 'Couldn’t accept this order. Try again.');
    } finally {
      setBusy(null);
    }
  };
  const reject = async () => {
    if (!me || !order || !scanned || busy) return;
    setBusy('reject');
    setActionError(null);
    try {
      await rejectOrder(order.id, me.staff.id, scanned.qrId, reason.trim());
      haptic.success();
      setRejectOpen(false);
      setOutcome('rejected');
    } catch (e) {
      haptic.error();
      setActionError(e instanceof Error ? e.message : 'Couldn’t reject this order. Try again.');
    } finally {
      setBusy(null);
    }
  };

  /* ── every scan I've made, newest first ── */
  const log = useMemo(() => {
    if (!state || !me) return [];
    return state.qrTokens
      .flatMap((q) => q.scans.filter((s) => s.staffId === me.staff.id && s.result !== 'CONSUMED').map((s) => ({ q, s })))
      .sort((a, b) => b.s.at.localeCompare(a.s.at))
      .slice(0, 20);
  }, [state, me]);

  const actualRows: ScanRow[] = useMemo(() => {
    if (!state || !me) return [];
    return log.map(({ q, s }) => {
      const o = findOrder(state, q.orderId);
      const c = o ? findCustomer(state, o.customerId) : undefined;
      const ok = s.result === 'VALID';
      return {
        key: `${q.id}-${s.at}`,
        ok,
        title: `${q.orderId}${c && o ? ` · ${displayName(c.name, canSeeContact(me.staff, o))}` : ''}`,
        meta: `${QR_PURPOSE_COPY[q.purpose].label} · ${ok ? (o ? STATUS_COPY[o.status].label : 'Checked') : s.reason}`,
        at: s.at,
        orderId: o && o.locationId === me.location.id ? o.id : undefined,
      };
    });
  }, [log, state, me]);

  const allScanRows = useMemo(() => {
    return [...actualRows, ...MOCK_SCAN_ROWS];
  }, [actualRows]);

  const insets = useSafeAreaInsets();
  const [heroH, setHeroH] = useState(0);

  // the scans drawer, exactly like customer WalletScreen: drag or tap its handle and it rises over the yellow card & topbar
  const lift = Math.round(Math.max(0, heroH - insets.top - 64) * 0.75);
  const pos = useSharedValue(0); // 0 = resting, 1 = raised
  const startPos = useSharedValue(0);
  const [isRaised, setIsRaised] = useState(false);

  const settle = (to: number) => {
    setIsRaised(to > 0.5);
    pos.set(withSpring(to, { damping: 22, stiffness: 240, mass: 0.8 }));
  };

  const give = (p: number) => (p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => startPos.set(pos.value),
        onPanResponderMove: (_, g) => {
          const p = startPos.value - g.dy / Math.max(lift, 1);
          pos.set(give(p));
        },
        onPanResponderRelease: (_, g) => settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.value > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos],
  );

  useWebDrag(
    'scans-handle',
    {
      onStart: () => startPos.set(pos.value),
      onMove: (dy) => {
        const v = startPos.value - dy / Math.max(lift, 1);
        pos.set(give(v));
      },
      onEnd: (vy) => settle(vy < -0.3 ? 1 : vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
    },
    [heroH, lift],
  );

  const toggle = () => {
    haptic.tap();
    settle(pos.value > 0.5 ? 0 : 1);
  };

  const listY = useRef(0);
  const onListScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    listY.current = e.nativeEvent.contentOffset.y;
  };
  const onListDragEnd = (e: { nativeEvent: { contentOffset: { y: number }; velocity?: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y <= 0 && pos.value > 0.5 && (e.nativeEvent.velocity?.y ?? 0) < -0.2) settle(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroH, lift]);

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

  const bottomGap = Math.max(insets.bottom, 12) + TAB_ROOM;

  const camTitle = intent === 'INTAKE' ? 'Scan to accept' : intent === 'DELIVERY' ? 'Scan delivery QR' : 'Scan customer QR';

  return (
    <View style={styles.root}>
      {/* ── Top navbar & hero card up top (dims & scales behind the drawer, exactly like WalletScreen) ── */}
      <Animated.View
        style={[
          styles.page,
          { paddingTop: Math.max(insets.top, 6) },
          heroStyle,
        ]}
        onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}
      >
        <Rise distance={8}>
          <TopBar
            padded={false}
            title="Scan"
            bell
            unread={unread}
            onBell={() => navigation.navigate('StaffNotifications' as any)}
            onHome={() => navigation.navigate('StaffTabs', { screen: 'StaffHome' } as any)}
          />
        </Rise>

        <View style={{ marginTop: space.sm }}>
        {/* ── the yellow card: the scan tile on the left, the code box underneath ── */}
        <Rise delay={60} distance={14} scale={0.98}>
          {scans || !me ? (
            <View style={[styles.card, styles.hero]}>
              <View style={styles.heroTop}>
                <Pressable
                  onPress={openCamera}
                  disabled={checking}
                  accessibilityRole="button"
                  accessibilityLabel="Open the camera to scan a QR code"
                  style={({ pressed }) => [styles.tile, webCursor, pressed && { opacity: 0.94, transform: [{ scale: 0.96 }] }]}
                >
                  <View style={styles.aim}>
                    {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                      <View key={c} style={[styles.corner, styles[c]]} />
                    ))}
                    <View style={styles.aimIcon}>
                      <Icon name="scan" size={20} color={NAVY} strokeWidth={2.2} />
                    </View>
                  </View>
                </Pressable>
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <View style={styles.liveDot} />
                    <Text style={styles.heroTitle}>
                      {camTitle}
                    </Text>
                  </View>
                  <Text style={styles.heroSub}>
                    {checking ? 'Checking code…' : expectOrderId ? `Only ${expectOrderId}’s code` : 'Drop-off, pickup and delivery codes'}
                  </Text>
                </View>
              </View>

              <View style={styles.btnRow}>
                <Pressable
                  onPress={openCamera}
                  disabled={checking}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.openBtn, webCursor, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <Icon name="scan" size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.openBtnText} numberOfLines={1}>{scanned ? 'Scan next' : 'Open camera'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setLookupError(null); setManualOpen(true); }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.typeBtn, webCursor, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <Icon name="edit" size={15} color={NAVY} strokeWidth={2.2} />
                  <Text style={styles.typeBtnText} numberOfLines={1}>Type code</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.section, styles.center]}>
              <View style={styles.bubbleLg}>
                <Icon name="scan" size={22} color={colors.inkSoft} />
              </View>
              <Text style={[styles.sectionTitle, styles.textCenter, { marginTop: space.md }]}>Your role doesn’t scan customer QR codes</Text>
              <Text style={[styles.linkSub, styles.textCenter]}>Counter, delivery and supervisor roles accept and hand over orders. Type an order number to look it up.</Text>
              <View style={[styles.manual, { alignSelf: 'stretch', marginTop: space.md }]}>
                <View style={styles.flex}>
                  <PillField
                    value={code}
                    onChangeText={(t) => {
                      setLookupError(null);
                      setCode(t.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11));
                    }}
                    placeholder="WB-1010"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Order number"
                  />
                </View>
                <Button label="Open" variant="dark" onPress={submit} disabled={!/^WB/i.test(code) || !valid} />
              </View>
              {lookupError ? <Text style={[shared.error, { marginTop: space.sm }]}>{lookupError}</Text> : null}
            </View>
          )}
        </Rise>

        {/* ── a refused code ── */}
        {refusal ? (
          <Pop from={0.94}>
            <View style={[styles.card, styles.section, styles.refused]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <View style={styles.stateHead}>
                <View style={[styles.bubbleLg, { backgroundColor: colors.danger }]}>
                  <Icon name={REFUSAL[refusal.code]?.icon ?? 'x'} size={20} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.kicker, { color: colors.danger }]}>Code not accepted</Text>
                  <Text style={styles.stateTitle}>{REFUSAL[refusal.code]?.title ?? 'Try another code'}</Text>
                </View>
              </View>
              <Text style={styles.body}>{refusal.reason}</Text>
              <View style={styles.actions}>
                <Button label="Scan again" icon="scan" variant="dark" onPress={openCamera} style={styles.flex} />
                {refusal.orderId && refusal.code !== 'WRONG_LOCATION' ? <Button label="Open order" variant="outline" onPress={() => navigation.navigate('StaffOrder', { orderId: refusal.orderId! })} style={styles.flex} /> : null}
              </View>
            </View>
          </Pop>
        ) : null}
        </View>
      </Animated.View>

      {/* ── Dimming backdrop behind the sheet when scrolled/raised (covers & dims TopBar too!) ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={isRaised ? 'auto' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => settle(0)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss scans drawer"
        />
      </Animated.View>

      {/* ── The scans sheet: white, rounded on top, rising over the hero and top navbar ── */}
      {heroH && (scans || !me) ? (
        <Animated.View
          nativeID={SHEET_ID}
          style={[
            styles.drawer,
            { top: heroH + space.sm, bottom: -lift },
            sheetStyle,
          ]}
        >
          <View nativeID="scans-handle" {...pan.panHandlers}>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={isRaised ? 'Collapse scans' : 'Expand scans'}
              hitSlop={10}
              style={[styles.drawerHit, webCursor]}
            >
              <View style={styles.drawerHandle} />
            </Pressable>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={isRaised ? 'Collapse scans' : 'Expand scans'}
              style={[styles.drawerHead, webCursor]}
            >
              <View style={styles.row}>
                <Text style={styles.drawerTitle}>My scans</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{allScanRows.length}</Text>
                </View>
              </View>
              <Icon name={isRaised ? 'chevronDown' : 'chevronUp'} size={18} color={colors.inkMuted} />
            </Pressable>
          </View>

          <Animated.View style={[styles.flex, listInset]}>
            <ScrollView
              style={styles.flex}
              onScroll={onListScroll}
              onScrollBeginDrag={onListDragBegin}
              onScrollEndDrag={onListDragEnd}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: space.lg,
                paddingBottom: bottomGap + 40,
              }}
              showsVerticalScrollIndicator={false}
            >
              {allScanRows.length ? (
                allScanRows.map((r, i) => (
                  <Pressable
                    key={r.key}
                    onPress={() => r.orderId && openScanOrder(r.orderId)}
                    disabled={!r.orderId}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title}, ${r.ok ? 'valid' : 'refused'}, ${ago(r.at)}`}
                    style={({ pressed }) => [styles.logRow, i > 0 && styles.lineRule, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <View
                      style={[
                        styles.logIcon,
                        {
                          backgroundColor: r.ok ? colors.successTint : colors.dangerTint,
                          borderWidth: 1,
                          borderColor: r.ok ? 'rgba(13, 122, 33, 0.18)' : 'rgba(235, 87, 87, 0.18)',
                        },
                      ]}
                    >
                      <Icon name={r.ok ? 'check' : 'x'} size={16} color={r.ok ? GREEN : colors.danger} strokeWidth={2.4} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.lineName} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.lineMeta} numberOfLines={1}>
                        {r.meta}
                      </Text>
                    </View>
                    <Text style={styles.logTime}>{ago(r.at)}</Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyLog}>
                  <Icon name="scan" size={20} color={colors.inkMuted} />
                  <Text style={styles.lineMeta}>Codes you scan show up here, valid or not.</Text>
                </View>
              )}
              {allScanRows.length ? <Text style={styles.end}>End of scans</Text> : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* ── Order details in an app drawer ── */}
      <BottomSheet
        visible={orderDrawerOpen && !!order && !!me}
        onClose={() => {
          setOrderDrawerOpen(false);
          if (outcome) reset();
        }}
        footer={
          order && me ? (
            !outcome ? (
              <View style={styles.drawerFooter}>
                {actionError && !rejectOpen ? (
                  <Text style={[shared.error, { marginBottom: 6, textAlign: 'center' }]}>{actionError}</Text>
                ) : null}

                {/* Confirm count checkbox fixed at bottom */}
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    setCounted((c) => !c);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: counted }}
                  accessibilityLabel={`Confirm count: ${plural(order.pieces, 'piece')}`}
                  style={({ pressed }) => [
                    styles.confirmCheck,
                    counted && styles.confirmCheckOn,
                    webCursor,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={[styles.confirmBox, counted && styles.confirmBoxOn]}>
                    {counted ? <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <Text
                    style={[styles.confirmCheckText, counted && styles.confirmCheckTextOn, styles.flex]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    I counted {plural(order.pieces, 'piece')} and {order.pieces === 1 ? 'it matches' : 'they match'} the order.
                  </Text>
                </Pressable>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => setRejectOpen(true)}
                    disabled={!!busy}
                    accessibilityRole="button"
                    accessibilityLabel="Reject order"
                    style={({ pressed }) => [styles.rejectBtn, webCursor, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                    <Icon name="x" size={16} color="#FFFFFF" strokeWidth={2.4} />
                  </Pressable>

                  <Pressable
                    onPress={accept}
                    disabled={!counted || !!busy}
                    accessibilityRole="button"
                    accessibilityLabel={isHome ? 'Accept & collect' : 'Accept order'}
                    style={({ pressed }) => [
                      styles.acceptBtn,
                      !counted && styles.acceptBtnDisabled,
                      webCursor,
                      counted && pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    {busy === 'accept' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={[styles.acceptBtnText, !counted && styles.acceptBtnTextDisabled]}>
                          {isHome ? 'Accept & collect' : 'Accept'}
                        </Text>
                        <Icon name="check" size={17} color="#FFFFFF" strokeWidth={2.6} />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.drawerFooter}>
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => {
                      setOrderDrawerOpen(false);
                      reset();
                      openCamera();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Scan next"
                    style={({ pressed }) => [styles.acceptBtn, webCursor, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.acceptBtnText}>Scan next</Text>
                    <Icon name="scan" size={17} color="#FFFFFF" strokeWidth={2.2} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setOrderDrawerOpen(false);
                      navigation.navigate('StaffOrder', { orderId: order.id });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open order page"
                    style={({ pressed }) => [styles.secondaryBtn, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.secondaryBtnText}>Open order</Text>
                    <Icon name="arrowUpRight" size={16} color={NAVY} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>
            )
          ) : undefined
        }
      >
        {order && me ? (
          <View style={styles.orderDrawerBox}>
            <View style={[styles.card, styles.section, outcome === 'rejected' ? styles.refused : styles.verified]}>
              <View style={styles.stateHead}>
                <View style={[styles.bubbleLg, { backgroundColor: outcome === 'rejected' ? colors.danger : GREEN }]}>
                  <Icon name={outcome === 'rejected' ? 'x' : 'check'} size={20} color="#FFFFFF" strokeWidth={2.6} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.kicker, { color: outcome === 'rejected' ? colors.danger : GREEN }]}>
                    {outcome === 'accepted' ? (isHome ? 'Collected' : 'Accepted') : outcome === 'rejected' ? 'Rejected & refunded' : `Valid ${isHome ? 'pickup' : 'drop-off'} QR`}
                  </Text>
                  <Text style={styles.stateTitle} numberOfLines={1}>
                    {order.id} · {name}
                  </Text>
                </View>
              </View>
              <View style={styles.tags}>
                <Tag label={`Paid ${money(order.payment.amount)}`} tone="ok" icon="wallet" />
                <Tag label={MODE_COPY[order.serviceMode].label} />
                <Tag label={plural(order.pieces, 'piece')} />
              </View>
              {outcome ? (
                <Text style={[styles.body, { marginTop: space.md }]}>
                  {outcome === 'accepted'
                    ? `Receipt ${receipt?.number ?? ''} is on ${name}’s phone now. ${isHome ? 'Bring the bag to the branch for washing.' : 'Tag the bag and put it in the wash queue.'}`
                    : `${money(order.payment.amount)} went back to ${name}’s wallet. Reason: ${order.rejectionReason ?? reason}`}
                </Text>
              ) : null}
            </View>

            <View style={[styles.card, styles.menuCard, { marginTop: space.md }]}>
              <InfoRow icon="user" label="Customer" value={name} />
              {order.pickup ? <InfoRow divider icon="calendar" label="Pickup" value={`${date(`${order.pickup.date}T00:00:00`)} · ${order.pickup.slotLabel}`} /> : null}
              {order.pickup && contact ? <InfoRow divider icon="home" label="Address" value={`${order.pickup.address}${order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''}`} /> : null}
              <InfoRow divider icon="clock" label="Requested" value={when(order.createdAt)} />
              <InfoRow divider icon="info" label="Status" value={STATUS_COPY[order.status].label} />
            </View>

            <Pressable
              onPress={() => {
                setOrderDrawerOpen(false);
                navigation.navigate('StaffOrder', { orderId: order.id });
              }}
              accessibilityRole="button"
              accessibilityLabel="Open order details page"
              style={({ pressed }) => [styles.fullOrderRow, webCursor, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.fullOrderLeft}>
                <View style={styles.fullOrderIcon}>
                  <Icon name="arrowUpRight" size={16} color={NAVY} strokeWidth={2.2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.fullOrderTitle}>Order Details Page</Text>
                  <Text style={styles.fullOrderSub}>View full timeline, tracking, and details</Text>
                </View>
              </View>
              <Icon name="chevronRight" size={18} color={colors.inkMuted} strokeWidth={2.2} />
            </Pressable>

            <View style={[styles.card, styles.section, { marginTop: space.md }]}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Items</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{plural(order.pieces, 'piece')}</Text>
                </View>
              </View>
              {order.lines.map((l, i) => (
                <View key={l.itemId} style={[styles.line, i > 0 && styles.lineRule]}>
                  <GarmentIcon name={l.icon} size={38} />
                  <View style={styles.flex}>
                    <Text style={styles.lineName}>{l.name}</Text>
                    <Text style={styles.lineMeta}>
                      {l.categoryName} · {l.qty} × {money(l.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.lineAmount}>× {l.qty}</Text>
                </View>
              ))}
              <View style={styles.totals}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>Subtotal</Text>
                  <Text style={styles.totalLineValue}>{money(order.subtotal)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>{isHome ? 'Pickup & delivery' : 'Service charge'}</Text>
                  <Text style={styles.totalLineValue}>{order.serviceCharge ? money(order.serviceCharge) : 'Free'}</Text>
                </View>
                <View style={styles.totalsRule} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total paid</Text>
                  <Text style={styles.totalValue}>{money(order.total)}</Text>
                </View>
              </View>
              {order.instructions ? <Text style={styles.instructions}>Customer note: {order.instructions}</Text> : null}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      

      <ScannerModal
        visible={camera}
        title={camTitle}
        onClose={() => setCamera(false)}
        onCode={(raw) => {
          setCamera(false);
          check(raw);
        }}
      />

      {/* ── App drawer for typing code manually ── */}
      <BottomSheet visible={manualOpen} onClose={() => setManualOpen(false)}>
        <View style={styles.sheetBox}>
          <Text style={shared.h1}>Type code</Text>
          <Text style={[shared.body, { marginTop: 4, marginBottom: space.md }]} numberOfLines={1}>
            Enter 10-digit code under customer’s QR or order number
          </Text>
          <View style={styles.sheetRow}>
            <View style={styles.sheetInputWrap}>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setLookupError(null);
                  setCode(t.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11));
                }}
                placeholder="ABCDE-12345 or WB-1010"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="QR code or order number"
                returnKeyType="go"
                onSubmitEditing={() => valid && submit()}
                style={styles.sheetInput}
                autoFocus
              />
            </View>
            <Pressable
              onPress={submit}
              disabled={!valid || (checking && !camera)}
              accessibilityRole="button"
              accessibilityLabel={/^WB/i.test(code) ? 'Open order' : 'Check code'}
              style={({ pressed }) => [
                styles.sheetCheckBtn,
                !valid && styles.sheetCheckBtnDisabled,
                webCursor,
                valid && pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
              ]}
            >
              {checking && !camera ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.sheetCheckBtnText, !valid && styles.sheetCheckBtnTextDisabled]}>
                  {/^WB/i.test(code) ? 'Open' : 'Check'}
                </Text>
              )}
            </Pressable>
          </View>
          {lookupError ? <Text style={[shared.error, { marginTop: space.sm }]}>{lookupError}</Text> : null}
          <View style={styles.sheetFoot}>
            <Icon name="shield" size={13} color={colors.inkMuted} strokeWidth={2.2} />
            <Text style={styles.sheetFootText} numberOfLines={1}>Single-use codes · order number only opens the order</Text>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        {order ? (
          <View>
            <Text style={shared.h1}>Reject {order.id}?</Text>
            <Text style={[shared.body, { marginTop: space.xs }]}>{money(order.payment.amount)} goes straight back to the customer’s wallet, and they’ll see your reason.</Text>
            <View style={styles.reasons} accessibilityRole="radiogroup">
              {REASONS.map((r) => (
                <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }} style={[styles.reason, reason === r && styles.reasonOn, webCursor]}>
                  <Text style={[styles.reasonText, reason === r && { color: '#FFFFFF' }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <PillTextArea value={reason} onChangeText={setReason} placeholder="Or write the reason" accessibilityLabel="Reason for rejecting" />
            {actionError && rejectOpen ? <Text style={[shared.error, { marginTop: space.sm }]}>{actionError}</Text> : null}
            <Button label="Reject & refund" variant="dark" onPress={reject} loading={busy === 'reject'} disabled={reason.trim().length < 3 || !!busy} style={{ marginTop: space.lg }} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function InfoRow({ icon, label, value, divider, right }: { icon: IconName; label: string; value: string; divider?: boolean; right?: React.ReactNode }) {
  return (
    <View style={[styles.infoRow, divider && styles.infoRule]}>
      <View style={styles.bubble}>
        <Icon name={icon} size={16} color={colors.ink} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {right}
    </View>
  );
}

const cleanCardShadow =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 3px rgba(10, 28, 62, 0.02), 0 4px 12px rgba(10, 28, 62, 0.035)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  page: { paddingHorizontal: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  backdrop: { backgroundColor: '#181410' },
  flex: { flex: 1, minWidth: 0 },
  grow: { flex: 1.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },

  head: { paddingHorizontal: 2, paddingTop: space.xs },
  headTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: colors.ink },
  headMeta: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 3 },
  headDash: { height: 0, borderTopWidth: 2, borderColor: '#9E988D', borderStyle: 'dashed', marginTop: space.md, marginBottom: 4 },

  card: { backgroundColor: '#FFFFFF', borderRadius: RADIUS, borderWidth: 1, borderColor: '#E5E1D8', ...cleanCardShadow },
  orderDrawerBox: { paddingBottom: space.lg },
  section: { padding: space.lg },
  beige: { backgroundColor: BEIGE, borderColor: 'transparent' },

  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: space.xs,
  },
  backBarText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: NAVY,
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: GREEN,
  },
  phoneBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  fullOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    marginTop: space.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#E5E1D8',
    ...cleanCardShadow,
  },
  fullOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  fullOrderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF6FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullOrderTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: NAVY,
  },
  fullOrderSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 1,
  },

  hero: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: HERO,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.12)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(230, 140, 20, 0.08)' } as object)
      : { shadowColor: '#E68C14', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 1 }),
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.08)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }),
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.3, color: NAVY },
  heroSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: 'rgba(10, 28, 62, 0.72)', marginTop: 3 },
  divider: { height: 1, backgroundColor: 'rgba(10, 28, 62, 0.12)', marginVertical: 18 },
  aim: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  corner: { position: 'absolute', width: 11, height: 11, borderColor: colors.orange },
  tl: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 4 },
  aimIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF6D6', alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  openBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 23,
    backgroundColor: NAVY,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.25)' } as object) : null),
  },
  openBtnText: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.1, color: '#FFFFFF' },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 28, 62, 0.12)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.06)' } as object) : null),
  },
  typeBtnText: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.1, color: NAVY },
  sheetBox: { paddingBottom: space.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetInputWrap: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F5F3EF',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sheetInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 0.5,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  sheetCheckBtn: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.20)' } as object) : null),
  },
  sheetCheckBtnDisabled: {
    backgroundColor: '#E5E1D8',
    ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as object) : null),
  },
  sheetCheckBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  sheetCheckBtnTextDisabled: {
    color: colors.inkMuted,
  },
  sheetFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.lg,
  },
  sheetFootText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },

  stateHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.3 },
  stateTitle: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.ink, marginTop: 2 },
  body: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft },
  refused: { backgroundColor: '#FFF6F6', borderColor: '#F6D5D5' },
  verified: { backgroundColor: '#F3FBF5', borderColor: '#CDEBD5' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  drawerFooter: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EB5757',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(235, 87, 87, 0.20)' } as object)
      : { shadowColor: '#EB5757', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }),
  },
  rejectBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  acceptBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 3px 10px rgba(39, 174, 96, 0.22)' } as object)
      : { shadowColor: '#27AE60', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 5, elevation: 2 }),
  },
  acceptBtnDisabled: {
    backgroundColor: '#A8DCBC',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none' } as object)
      : { elevation: 0, shadowOpacity: 0 }),
  },
  acceptBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  acceptBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D5D0C5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: NAVY,
    letterSpacing: -0.2,
  },

  bubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5EFE6', alignItems: 'center', justifyContent: 'center' },
  bubbleLg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5EFE6', alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.4, color: NAVY },
  pill: { height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: CHIP, borderWidth: 1, borderColor: '#E8E4DA', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lineRule: { borderTopWidth: 1, borderTopColor: RULE },
  lineName: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  lineMeta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  lineAmount: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  totals: { marginTop: space.sm, padding: space.md, borderRadius: 18, backgroundColor: BEIGE, gap: 6 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLineLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft },
  totalLineValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  totalsRule: { height: 1, backgroundColor: '#E3DDD0', marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  instructions: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: space.md },

  menuCard: { paddingVertical: space.xs, paddingHorizontal: space.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  infoRule: { borderTopWidth: 1, borderTopColor: '#F0EFEA' },
  infoLabel: { fontFamily: fonts.medium, fontSize: 11.5, letterSpacing: 0.3, color: colors.inkMuted },
  infoValue: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 2 },

  scansSection: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginTop: space.md,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#E5E1D8',
    ...cleanCardShadow,
  },
  scansSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.xs },
  confirmCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#F7F6F2',
    borderWidth: 1.5,
    borderColor: '#E8E4DA',
    marginBottom: 10,
  },
  confirmCheckOn: {
    backgroundColor: '#EEF8F1',
    borderColor: '#27AE60',
  },
  confirmCheckText: {
    fontFamily: fonts.semibold,
    fontSize: 12.2,
    lineHeight: 16,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  confirmCheckTextOn: {
    color: '#1B7A43',
    fontFamily: fonts.bold,
  },
  confirmBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.75,
    borderColor: '#A8A298',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  confirmBoxOn: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: '#F7F5F0', borderWidth: 1.5, borderColor: '#E8E4DA' },
  checkOn: { backgroundColor: '#EEF3FB', borderColor: NAVY },
  checkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.75, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: NAVY, borderColor: NAVY },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.inkMuted, textAlign: 'center', marginTop: 8 },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  logIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  logTime: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#8A8275' },
  emptyLog: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg },
  end: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted, opacity: 0.6, marginTop: space.lg },
  drawerShade: { backgroundColor: '#181410' },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DA',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 -6px 24px rgba(10, 28, 62, 0.10)' } as object) : { shadowColor: '#000000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 }),
  },
  drawerHit: {
    alignSelf: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 28,
  },
  drawerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },
  drawerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 2,
    paddingBottom: space.sm,
  },
  drawerTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: NAVY },

  linkTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  linkSub: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted, marginTop: 2 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },

  reasons: { gap: space.xs, marginVertical: space.lg },
  reason: { padding: space.md, borderRadius: 16, backgroundColor: CHIP },
  reasonOn: { backgroundColor: colors.ink },
  reasonText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
});
