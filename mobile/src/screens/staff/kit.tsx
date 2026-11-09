/**
 * The staff app's building blocks, cut from the customer app's own cloth: the warm white page, the collapsing top
 * bar with the logo mark, white cards with a thin warm edge and one soft shadow, pill filters, round buttons.
 * Every staff screen is made from these, so the two apps read as one product.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { Icon, type IconName } from '../../components/app/Icon';
import { Pop, Rise } from '../../components/app/motion';
import { Button as BaseButton, fade } from '../../components/app/primitives';
import { TopBar } from '../../components/app/TopBar';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { TONE } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { money, plural } from '../../lib/format';
import { MODE_COPY, PROCESSING_STAGES, STAGE_COPY, STATUS_COPY } from '../../mock/engine/lifecycle';
import { findCustomer } from '../../mock/engine/selectors';
import * as staffService from '../../mock/services/staffService';
import { mockStore } from '../../mock/store/mockStore';
import type { LaundryNotification, LaundryOrder, MockState, Staff } from '../../mock/types';
import type { RootStackParamList } from '../../navigation/types';
import { canSeeContact, displayName, nextAction, STAGE_ICON, waitingOn, type StaffAction } from '../../staff/work';
import { prefsFor, useWorkforce, type NotificationPrefs } from '../../staff/workforce';
import { colors, fonts, space } from '../../theme';

export const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* The customer app's page tokens (Home, Orders, Profile). */
export const BG = '#FAF9F6';
export const BG_RGB = '250, 249, 246';
export const BEIGE = '#F1EDE4';
export const CHIP = '#F4F2EE';
export const EDGE = '#E8E4DA';
export const RULE = '#EFECE6';
export const RADIUS = 26;
export const PAGE = space.lg;
/** Room under the content for the floating tab bar. */
export const TAB_ROOM = 64;

export const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(40, 30, 10, 0.06)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 };

/* ───────────── who is signed in ───────────── */

type StaffNav = NativeStackNavigationProp<RootStackParamList>;

/** Kinds of staff notification each preference controls; anything else always shows. */
const PREF_FOR: Partial<Record<LaundryNotification['kind'], keyof NotificationPrefs>> = {
  NEW_REQUEST: 'newOrders',
  DELIVERY_QR_READY: 'deliveries',
  ISSUE_REPORTED: 'issues',
};

export function staffFeed(s: MockState, st: Staff, prefs: NotificationPrefs) {
  return s.notifications.filter((n) => n.audience === 'staff' && n.recipientId === st.locationId && (!PREF_FOR[n.kind] || prefs[PREF_FOR[n.kind]!]));
}

/** The live laundry state, the signed-in staff member and their branch, and what they want to be told about. */
export function useStaff() {
  const state = useLaundryState();
  const me = useCurrentStaff();
  const wf = useWorkforce();
  const prefs = useMemo(() => prefsFor(wf, me?.staff.id ?? ''), [wf, me?.staff.id]);
  const unread = useMemo(() => (state && me ? staffFeed(state, me.staff, prefs).filter((n) => !n.readAt).length : 0), [state, me, prefs]);
  return { state, me, wf, prefs, unread };
}

/* ───────────── page ───────────── */

/**
 * A staff page: the top bar over the page, collapsing as you read down; content in a centred column. `tab` pages
 * leave room for the tab bar; pushed pages can add a footer of actions. Every page has the logo (home) and the side menu.
 */
export function StaffPage({
  title,
  subtitle,
  eyebrow,
  dot,
  tab = true,
  footer,
  onRefresh,
  children,
  bell = true,
  overlay,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  dot?: string;
  tab?: boolean;
  footer?: React.ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  children: React.ReactNode;
  bell?: boolean;
  /** Floats over the page, under the top bar: e.g. a drawer that rises from the bottom. */
  overlay?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const navigation = useNavigation<StaffNav>();
  const { unread } = useStaff();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    haptic.tap();
    try {
      await (onRefresh ? onRefresh() : mockStore.ready());
      await new Promise((r) => setTimeout(r, 450));
    } finally {
      setRefreshing(false);
    }
  };
  const bottom = footer ? space.lg : tab ? Math.max(insets.bottom, 12) + TAB_ROOM + space.md : Math.max(insets.bottom, 12) + space.xl;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingTop: bar.height + space.xs, paddingBottom: bottom }}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange, colors.navy]} />}
      >
        <View style={styles.column}>{children}</View>
      </Animated.ScrollView>
      {overlay}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
      <CollapsingBar bar={bar} tint={BG_RGB} style={{ paddingTop: Math.max(insets.top, 6), paddingBottom: space.sm }}>
        <View style={styles.barInner}>
          <TopBar
            padded={false}
            title={title}
            subtitle={subtitle}
            eyebrow={eyebrow}
            dot={dot}
            bell={bell}
            unread={unread}
            onBell={() => navigation.navigate('StaffNotifications')}
            onHome={() => navigation.navigate('StaffTabs', { screen: 'StaffHome' })}
          />
        </View>
      </CollapsingBar>
    </View>
  );
}

/**
 * The customer app's pill button. Staff screens often show a step that isn't possible yet (check-in not open, count
 * not ticked), so a disabled button here looks disabled: solid but faded, never see-through.
 */
export function Button(props: React.ComponentProps<typeof BaseButton>) {
  const v = props.variant ?? 'primary';
  const off = props.disabled && !props.loading;
  const look = !off ? null : v === 'primary' ? { backgroundColor: fade(colors.orange, 0.45), borderColor: fade(colors.orange, 0.45) } : v === 'dark' ? { backgroundColor: fade('#0A1C3E', 0.55), borderColor: fade('#0A1C3E', 0.55) } : { opacity: 0.5 };
  return <BaseButton {...props} style={[props.style, look]} />;
}

/* ───────────── surfaces ───────────── */

/** The white card with a thin warm edge, as on Profile. `tone="beige"` is the calendar card. */
export function Panel({ children, style, tone = 'white' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'beige' }) {
  return <View style={[tone === 'white' ? styles.panel : styles.panelBeige, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.section} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [styles.sectionLink, webCursor, pressed && { opacity: 0.6 }]}>
          <Text style={styles.sectionAction}>{action}</Text>
          <Icon name="arrowRight" size={14} color={colors.navy} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A small rounded label: "Demo data", "Assigned to you", "Live". */
export function Tag({ label, tone = 'chip', icon }: { label: string; tone?: 'chip' | 'warn' | 'ok' | 'navy' | 'danger'; icon?: IconName }) {
  const t = TAG[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={11} color={t.fg} strokeWidth={2.4} /> : <View style={[styles.tagDot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}
const TAG = {
  chip: { bg: CHIP, fg: colors.inkSoft },
  warn: { bg: '#FFF4D9', fg: '#B97800' },
  ok: { bg: colors.successTint, fg: '#0D7A21' },
  navy: { bg: '#EBF6FE', fg: colors.navy },
  danger: { bg: colors.dangerTint, fg: colors.danger },
} as const;

/** One line of context above content: what's going on, or what went wrong. */
export function Notice({ tone = 'info', icon, title, children, style }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; icon?: IconName; title?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = NOTICE[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }, style]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={icon ?? t.icon} size={16} color={t.fg} strokeWidth={2.1} />
      <View style={styles.flex}>
        {title ? <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text> : null}
        {isTextual(children) ? <Text style={styles.noticeText}>{children}</Text> : children}
      </View>
    </View>
  );
}
/** Plain words (even several pieces, like `Paid {amount} from wallet`) get the notice's text style. */
const isTextual = (c: React.ReactNode): boolean => typeof c === 'string' || typeof c === 'number' || (Array.isArray(c) && c.length > 0 && c.every((x) => typeof x === 'string' || typeof x === 'number'));
const NOTICE = {
  info: { bg: '#EBF6FE', fg: colors.navy, icon: 'info' as IconName },
  warn: { bg: '#FFF4D9', fg: '#8A5A00', icon: 'alert' as IconName },
  danger: { bg: colors.dangerTint, fg: colors.danger, icon: 'alert' as IconName },
  ok: { bg: colors.successTint, fg: '#0D7A21', icon: 'check' as IconName },
};

/* ───────────── orders ───────────── */

/** The status chip, in the customer app's status tones. */
export function StatusChip({ order }: { order: LaundryOrder }) {
  const st = STATUS_COPY[order.status];
  const label = order.status === 'PROCESSING' && order.processingStage ? STAGE_COPY[order.processingStage].label : st.label;
  const tone = TONE[st.tone];
  return (
    <View style={[styles.status, { backgroundColor: tone.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.statusText, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Five short bars, one per wash-floor step, filled up to where the order is. */
export function StageTrack({ order, compact }: { order: LaundryOrder; compact?: boolean }) {
  const at = order.status === 'PROCESSING' ? PROCESSING_STAGES.indexOf(order.processingStage ?? 'WASHING') : ['READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED'].includes(order.status) ? PROCESSING_STAGES.length : -1;
  return (
    <View accessible accessibilityLabel={at >= 0 && at < PROCESSING_STAGES.length ? `Stage ${at + 1} of 5: ${STAGE_COPY[PROCESSING_STAGES[at]].label}` : undefined}>
      <View style={styles.track}>
        {PROCESSING_STAGES.map((s, i) => (
          <View key={s} style={[styles.trackBar, i < at && styles.trackDone, i === at && styles.trackNow]} />
        ))}
      </View>
      {!compact ? (
        <View style={styles.trackLabels}>
          {PROCESSING_STAGES.map((s, i) => (
            <View key={s} style={styles.trackLabel}>
              <Icon name={STAGE_ICON[s]} size={14} color={i <= at ? colors.ink : colors.inkMuted} strokeWidth={i === at ? 2.4 : 1.8} />
              <Text style={[styles.trackText, i === at && styles.trackTextNow]} numberOfLines={1}>
                {STAGE_COPY[s].label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * An order in a list: what it is, whose it is, where it stands, and — side by side with the card, never inside its
 * tap target — the one button for this person's next step.
 */
export function OrderCard({
  order,
  state,
  me,
  onOpen,
  onAction,
  busy,
  due,
  urgent,
}: {
  order: LaundryOrder;
  state: MockState;
  me: Staff;
  onOpen: () => void;
  onAction?: (a: StaffAction) => void;
  busy?: boolean;
  due?: string;
  urgent?: boolean;
}) {
  const action = nextAction(state, order, me);
  const customer = findCustomer(state, order.customerId);
  const name = displayName(customer?.name ?? 'Customer', canSeeContact(me, order));
  const assignedToMe = order.assignedTo === me.id;
  return (
    <View style={styles.order}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${order.id}, ${name}, ${STATUS_COPY[order.status].label}`} style={({ pressed }) => [webCursor, pressed && { opacity: 0.75 }]}>
        <View style={styles.orderTop}>
          <View style={styles.orderArt}>
            <GarmentIcon name={order.lines[0]?.icon ?? 'shirt'} size={34} />
          </View>
          <View style={styles.flex}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderId}>{order.id}</Text>
              <Text style={styles.orderMode} numberOfLines={1}>
                · {MODE_COPY[order.serviceMode].short}
              </Text>
              {assignedToMe ? (
                <View style={styles.mine} accessibilityLabel="Assigned to you">
                  <Icon name="user" size={10} color={colors.navy} strokeWidth={2.4} />
                  <Text style={styles.mineText}>Yours</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.orderName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.orderMeta} numberOfLines={1}>
              {plural(order.pieces, 'piece')} · {money(order.total)} · {order.lines.map((l) => l.categoryName).filter((c, i, a) => a.indexOf(c) === i).join(', ')}
            </Text>
          </View>
        </View>
        {order.status === 'PROCESSING' ? (
          <View style={{ marginTop: space.md }}>
            <StageTrack order={order} compact />
          </View>
        ) : null}
        <View style={styles.orderFoot}>
          <StatusChip order={order} />
          <Text style={[styles.orderHint, urgent && { color: colors.danger }]} numberOfLines={1}>
            {due ?? waitingOn(state, order, me)}
          </Text>
        </View>
      </Pressable>
      {action && onAction ? (
        <Pressable
          onPress={() => onAction(action)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${action.label}, ${order.id}`}
          accessibilityState={{ busy: !!busy }}
          style={({ pressed }) => [styles.orderBtn, action.kind.startsWith('scan') ? styles.orderBtnScan : styles.orderBtnDark, webCursor, pressed && { transform: [{ scale: 0.98 }], opacity: 0.94 }, busy && { opacity: 0.6 }]}
        >
          <Icon name={action.icon} size={16} color="#FFFFFF" strokeWidth={2.1} />
          <Text style={styles.orderBtnText}>{busy ? 'Saving…' : action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ───────────── doing a step ───────────── */

/**
 * Runs an order step: scans open the scanner; the rest go to the engine. One at a time per order (a second tap while
 * the first is saving does nothing), with haptics and a readable error.
 */
export function useOrderAction(staffId: string | undefined) {
  const navigation = useNavigation<StaffNav>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ orderId: string; message: string } | null>(null);
  const running = useRef(new Set<string>());

  const run = useCallback(
    async (order: LaundryOrder, a: StaffAction) => {
      if (!staffId) return;
      if (a.kind === 'scan-intake' || a.kind === 'scan-delivery') {
        haptic.tap();
        navigation.navigate('StaffTabs', { screen: 'StaffScan', params: { intent: a.kind === 'scan-intake' ? 'INTAKE' : 'DELIVERY', orderId: order.id, nonce: Date.now() } });
        return;
      }
      if (running.current.has(order.id)) return;
      running.current.add(order.id);
      setBusy(order.id);
      setError(null);
      try {
        if (a.kind === 'process') await staffService.startProcessing(order.id, staffId);
        else if (a.kind === 'stage') await staffService.advanceStage(order.id, staffId, a.to);
        else if (a.kind === 'ready') await staffService.markReady(order.id, staffId);
        else await staffService.handOver(order.id, staffId);
        haptic.success();
      } catch (e) {
        haptic.error();
        setError({ orderId: order.id, message: e instanceof Error ? e.message : 'That didn’t work. Try again.' });
      } finally {
        running.current.delete(order.id);
        setBusy(null);
      }
    },
    [staffId, navigation],
  );
  return { run, busy, error, clearError: () => setError(null) };
}

/* ───────────── small pieces ───────────── */

/** A round icon in beige, as Profile's quick actions. */
export function RoundIcon({ icon, tone = 'beige', size = 40, color }: { icon: IconName; tone?: 'beige' | 'chip' | 'ink' | 'orange' | 'ok' | 'danger'; size?: number; color?: string }) {
  const bg = { beige: BEIGE, chip: CHIP, ink: colors.ink, orange: colors.orange, ok: colors.successTint, danger: colors.dangerTint }[tone];
  const fg = color ?? ({ beige: colors.ink, chip: colors.ink, ink: '#FFFFFF', orange: '#FFFFFF', ok: '#0D7A21', danger: colors.danger }[tone]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={fg} strokeWidth={2} />
    </View>
  );
}

/** A tappable row inside a Panel: icon, label and detail, chevron. */
export function Row({ icon, label, detail, right, onPress, divider, danger }: { icon?: IconName; label: string; detail?: string; right?: React.ReactNode; onPress?: () => void; divider?: boolean; danger?: boolean }) {
  const body = (
    <>
      {icon ? <RoundIcon icon={icon} tone={danger ? 'danger' : 'beige'} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chevronRight" size={18} color={colors.inkMuted} strokeWidth={2.2} /> : null)}
    </>
  );
  return (
    <>
      {divider ? <View style={styles.rowRule} /> : null}
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, webCursor, pressed && { opacity: 0.7 }]}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
    </>
  );
}

/** Label on the left, value on the right. */
export function Line({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && { color: colors.ink, fontFamily: fonts.semibold }]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineStrong, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

/** The end of a scan flow: a big tick (or cross), what happened, and where to go next. */
export function Outcome({ ok, title, message, children }: { ok: boolean; title: string; message: string; children?: React.ReactNode }) {
  return (
    <View style={styles.outcome} accessibilityLiveRegion="polite">
      <Pop from={0.5}>
        <View style={[styles.outcomeIcon, { backgroundColor: ok ? '#12AD2B' : colors.danger }]}>
          <Icon name={ok ? 'check' : 'x'} size={38} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </Pop>
      <Rise delay={120}>
        <Text style={styles.outcomeTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[shared.body, { textAlign: 'center' }]}>{message}</Text>
      </Rise>
      <Rise delay={220} style={styles.outcomeButtons}>
        {children}
      </Rise>
    </View>
  );
}

export const shared = StyleSheet.create({
  kicker: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  h1: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.6, color: colors.ink },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  strong: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.danger },
  rule: { height: 1, backgroundColor: RULE, marginVertical: space.md },
  big: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  column: { paddingHorizontal: PAGE, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  barInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: EDGE },
  footer: { paddingTop: space.md, paddingHorizontal: PAGE, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: EDGE },
  footerInner: { maxWidth: 560 - PAGE * 2, width: '100%', alignSelf: 'center', gap: space.sm },

  panel: { backgroundColor: '#FFFFFF', borderRadius: RADIUS, padding: space.lg, borderWidth: 1, borderColor: EDGE, ...soft },
  panelBeige: { backgroundColor: BEIGE, borderRadius: RADIUS, padding: space.lg, borderWidth: 1, borderColor: '#E6E0D4' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md },
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionAction: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },

  tag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { fontFamily: fonts.semibold, fontSize: 11.5 },

  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: 16, alignItems: 'flex-start' },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, marginBottom: 1 },
  noticeText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft },

  status: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13, maxWidth: 170, flexShrink: 0 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.medium, fontSize: 12 },

  track: { flexDirection: 'row', gap: 4 },
  trackBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E9E5DC' },
  trackDone: { backgroundColor: colors.ink },
  trackNow: { backgroundColor: colors.orange },
  trackLabels: { flexDirection: 'row', marginTop: space.sm, gap: 4 },
  trackLabel: { flex: 1, alignItems: 'center', gap: 4 },
  trackText: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.inkMuted, textAlign: 'center' },
  trackTextNow: { fontFamily: fonts.semibold, color: colors.ink },

  order: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, borderWidth: 1, borderColor: EDGE, ...soft },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orderArt: { width: 48, height: 48, borderRadius: 16, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderId: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  orderMode: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted },
  orderName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink, marginTop: 1 },
  orderMeta: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted },
  orderFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: RULE },
  orderHint: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft, textAlign: 'right' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: '#E6EEF8' },
  mineText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.navy },
  orderBtn: { marginTop: space.md, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  orderBtnScan: { backgroundColor: colors.orange },
  orderBtnDark: { backgroundColor: colors.ink },
  orderBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFFFFF' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  rowRule: { height: 1, backgroundColor: RULE },
  rowLabel: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.ink },
  rowDetail: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted, marginTop: 1 },

  outcome: { alignItems: 'center', paddingTop: space.xxxl, gap: space.md },
  outcomeIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  outcomeTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.8, color: colors.ink, textAlign: 'center', marginBottom: space.xs },
  outcomeButtons: { width: '100%', gap: space.sm, marginTop: space.xl },

  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: space.md },
  lineLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, flexShrink: 1 },
  lineValue: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, textAlign: 'right', flexShrink: 1 },
  lineStrong: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
});
