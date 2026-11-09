import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../../components/app/Icon';
import { Rise, useFocusReplay } from '../../components/app/motion';
import { Avatar, SectionHeader } from '../../components/app/primitives';
import { EmptyState, Skeleton } from '../../components/app/states';
import { STAFF_ROLE_LABEL } from '../../laundry/labels';
import { ago, money, plural, time } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { PROCESSING_STAGES, STAGE_COPY } from '../../mock/engine/lifecycle';
import { markNotificationsRead } from '../../mock/services/notificationService';
import type { LaundryNotification } from '../../mock/types';
import type { StaffTabProps } from '../../navigation/types';
import { useSession } from '../../session/session';
import {
  branchOrders,
  doneToday,
  exceptions,
  isSupervisor,
  matchesFilter,
  ROLE,
  STAGE_ICON,
  workload,
} from '../../staff/work';
import {
  checkInState,
  dayKey,
  hhmmLabel,
  payrollFor,
  recordFor,
} from '../../staff/workforce';
import { colors, fonts, space } from '../../theme';
import {
  CHIP,
  Panel,
  RADIUS,
  RULE,
  shared,
  soft,
  staffFeed,
  StaffPage,
  useStaff,
  webCursor,
} from './kit';

/** A fresh value each time the scanner is opened, so it starts clean. */
const stamp = () => Date.now();

const HERO_YELLOW = '#FED843';
const NAVY = '#0A1C3E';
const GREEN = '#0D7A21';

const PERKS = [
  { icon: 'clock', label: '48h SLA', tint: colors.orange },
  { icon: 'scan', label: 'Verified pieces', tint: colors.navy },
  { icon: 'shield', label: 'Digital audit', tint: '#12AD2B' },
] as const;

type Look = { icon: IconName; bg: string; fg: string };
const ORANGE_LOOK: Look = { icon: 'inbox', bg: '#FFF1E0', fg: colors.orange };
const LOOK: Partial<Record<LaundryNotification['kind'], Look>> = {
  NEW_REQUEST: ORANGE_LOOK,
  VERIFY_CLOTHES: { ...ORANGE_LOOK, icon: 'shirt' },
  DELIVERY_QR_READY: { icon: 'scan', bg: '#EEF3FB', fg: colors.navy },
  PAYMENT_COMPLETED: { icon: 'wallet', bg: colors.successTint, fg: '#0F8A27' },
  ISSUE_REPORTED: { icon: 'alert', bg: '#FDF2F4', fg: colors.danger },
  ORDER_CANCELLED: { icon: 'x', bg: '#F1F5F9', fg: '#64748B' },
};
const lookFor = (n: LaundryNotification): Look => LOOK[n.kind] ?? { ...ORANGE_LOOK, icon: 'bell' };

export function StaffHomeScreen({ navigation }: StaffTabProps<'StaffHome'>) {
  const replay = useFocusReplay();
  const { state, me, wf, prefs } = useStaff();
  const { signOut } = useSession();

  const notifications = useMemo(() => {
    if (!state || !me) return [];
    return staffFeed(state, me.staff, prefs)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }, [state, me, prefs]);

  const openNotification = (n: LaundryNotification) => {
    haptic.tap();
    if (!n.readAt) markNotificationsRead([n.id]).catch(() => {});
    if (n.orderId) {
      navigation.navigate('StaffOrder', { orderId: n.orderId });
    } else {
      navigation.navigate('StaffNotifications');
    }
  };

  if (!state || !me) {
    return (
      <StaffPage title="Washing Basket" bell={false}>
        {state && !me ? (
          <EmptyState
            icon="user"
            title="Staff account not found"
            message="Sign in again with the staff number and your branch’s PIN code."
            action={{ label: 'Sign out', onPress: signOut }}
          />
        ) : (
          <View style={{ gap: space.md }}>
            <Skeleton height={70} width={200} radius={12} />
            <Skeleton height={176} radius={RADIUS} />
            <Skeleton height={112} radius={22} />
          </View>
        )}
      </StaffPage>
    );
  }

  const { staff, location } = me;
  const role = ROLE[staff.role];
  const boss = isSupervisor(staff);
  const orders = branchOrders(state, staff);
  const first = staff.name.split(' ')[0];

  // attendance: are they on shift?
  const today = dayKey();
  const rec = wf ? recordFor(wf, staff.id, today) : undefined;
  const shift = wf ? checkInState(wf, staff) : null;
  const plan = shift?.plan;
  const onShift = !!rec && !rec.checkOut;
  const shiftLine =
    plan?.kind === 'WORK'
      ? onShift
        ? `On shift since ${time(rec!.checkIn)}`
        : rec?.checkOut
          ? `Shift done · out at ${time(rec.checkOut)}`
          : `${plan.shift.label} · ${hhmmLabel(plan.shift.start)}`
      : plan?.kind === 'HOLIDAY'
        ? `Holiday · ${plan.name}`
        : plan?.kind === 'LEAVE'
          ? 'On leave today'
          : 'Day off';

  const stageCounts = PROCESSING_STAGES.map((s) => ({
    s,
    n: orders.filter((o) => o.status === 'PROCESSING' && (o.processingStage ?? 'WASHING') === s).length,
  }));
  const waitingFloor = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PICKUP_CONFIRMED').length;
  const exc = boss ? exceptions(state, staff) : null;
  const team = boss ? workload(state, staff).filter((w) => w.staff.id !== staff.id) : [];

  // salary & earnings (wallet card)
  const pay = staff ? payrollFor(staff.id) : undefined;
  const statements = pay?.statements ?? [];
  const lastPaid = statements.find((s) => s.status === 'PAID');
  const salaryVal = lastPaid ? lastPaid.net : (pay?.salary.monthlyGross ?? 24000);
  const salaryFormatted = money(salaryVal);

  // number of scans (matching StaffScanScreen's allScanRows count)
  const totalScans = useMemo(() => {
    if (!state || !me) return 4;
    const actual = state.qrTokens
      .flatMap((q) => q.scans.filter((s) => s.staffId === me.staff.id && s.result !== 'CONSUMED'))
      .length;
    return actual + 4;
  }, [state, me]);

  return (
    <StaffPage
      title={location.shortName}
      subtitle={`${STAFF_ROLE_LABEL[staff.role]} · ${location.city}`}
      dot={onShift ? '#22A04B' : colors.inkMuted}
    >
      {/* ── Greeting & Shift Status (Customer HomeScreen style) ── */}
      <Rise replay={replay} distance={10}>
        <View style={styles.greeting}>
          <Text style={styles.hello} accessibilityRole="header">
            Hello,{'\n'}
            {first}!
          </Text>
          <View style={styles.shift} accessibilityLabel={shiftLine}>
            <View style={styles.shiftRow}>
              <View style={[styles.liveDot, { backgroundColor: onShift ? '#12AD2B' : colors.inkMuted }]} />
              <Text style={styles.shiftLabel}>{role.title}</Text>
            </View>
            <Text style={styles.shiftText} numberOfLines={1}>
              {shiftLine}
            </Text>
          </View>
        </View>
      </Rise>

      {/* ── Yellow Scan QR Hero Box (Signature Staff Scanner Hero) ── */}
      <Rise replay={replay} delay={40} distance={12} scale={0.98}>
        <View style={styles.scanHero}>
          <View style={styles.scanHeroTop}>
            <Pressable
              onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
              accessibilityRole="button"
              accessibilityLabel="Open camera to scan QR code"
              style={({ pressed }) => [styles.scanTile, webCursor, pressed && { opacity: 0.94, transform: [{ scale: 0.96 }] }]}
            >
              <View style={styles.scanAim}>
                {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                  <View key={c} style={[styles.scanCorner, styles[c]]} />
                ))}
                <View style={styles.scanAimIcon}>
                  <Icon name="scan" size={20} color={NAVY} strokeWidth={2.2} />
                </View>
              </View>
            </Pressable>
            <View style={styles.flex}>
              <View style={styles.scanRow}>
                <View style={styles.scanLiveDot} />
                <Text style={styles.scanHeroTitle}>Scan to accept</Text>
              </View>
              <Text style={styles.scanHeroSub} numberOfLines={1}>
                Drop-off, pickup and delivery codes
              </Text>
            </View>
          </View>

          <View style={styles.scanBtnRow}>
            <Pressable
              onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
              accessibilityRole="button"
              accessibilityLabel="Open camera"
              style={({ pressed }) => [styles.scanOpenBtn, webCursor, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Icon name="scan" size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.scanOpenBtnText} numberOfLines={1}>Open camera</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
              accessibilityRole="button"
              accessibilityLabel="Type code"
              style={({ pressed }) => [styles.scanTypeBtn, webCursor, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Icon name="edit" size={15} color={NAVY} strokeWidth={2.2} />
              <Text style={styles.scanTypeBtnText} numberOfLines={1}>Type code</Text>
            </Pressable>
          </View>
        </View>
      </Rise>

      {/* ── Overview Tiles (Salary & Scans Pair) ── */}
      <Rise replay={replay} delay={70} distance={16} scale={0.97}>
        <View style={styles.gridWrap}>
          {/* Pair: Left = Salary (Wallet Orange), Right = Number of Scans */}
          <View style={styles.pairRow}>
            {/* Left Tile: Salary in Wallet Orange */}
            <Tile
              onPress={() => (navigation as any).navigate('StaffSalary')}
              label={`My salary: ${salaryFormatted}`}
              style={[styles.pairTile, styles.salaryTile]}
            >
              <View style={styles.pairTop}>
                <View style={styles.salaryTag}>
                  <Text style={styles.salaryTagText}>Salary</Text>
                </View>
                <View style={styles.salaryGoDot}>
                  <Icon name="arrowUpRight" size={13} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </View>
              <View>
                <Text style={styles.salaryNum} numberOfLines={1} adjustsFontSizeToFit>
                  {salaryFormatted}
                </Text>
                <Text style={styles.salaryCaption} numberOfLines={1}>
                  {lastPaid?.paidOn ? 'Paid this month' : 'Monthly gross'}
                </Text>
              </View>
            </Tile>

            {/* Right Tile: Number of Scans */}
            <Tile
              onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
              label={`My scans: ${totalScans} scans`}
              style={styles.pairTile}
            >
              <View style={styles.pairTop}>
                <View style={styles.pairTag}>
                  <View style={[styles.tagDot, { backgroundColor: colors.navy }]} />
                  <Text style={styles.pairTagText}>My Scans</Text>
                </View>
                <View style={styles.pairIconDot}>
                  <Icon name="scan" size={13} color={colors.inkSoft} strokeWidth={2.2} />
                </View>
              </View>
              <View>
                <Text style={styles.pairNum}>{totalScans}</Text>
                <Text style={styles.pairCaption} numberOfLines={1}>
                  {totalScans === 1 ? '1 scan recorded' : `${totalScans} scans recorded`}
                </Text>
              </View>
            </Tile>
          </View>
        </View>
      </Rise>

      {/* ── Perks Bar (Strictly 1 single line) ── */}
      <Rise replay={replay} delay={140} distance={8}>
        <View
          style={styles.perks}
          accessibilityRole="text"
          accessibilityLabel="48h SLA, verified pieces, digital audit"
        >
          {PERKS.map((k, i) => (
            <React.Fragment key={k.label}>
              {i ? <View style={styles.perkSep} /> : null}
              <View style={styles.perk}>
                <Icon name={k.icon} size={14} color={k.tint} strokeWidth={2} />
                <Text style={styles.perkText} numberOfLines={1}>
                  {k.label}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Rise>

      {/* ── Notifications ── */}
      <Rise replay={replay} delay={180} distance={16}>
        <SectionHeader
          style={{ marginTop: space.xl }}
          title="Notifications"
          action={notifications.length > 0 ? 'View all' : undefined}
          onAction={() => navigation.navigate('StaffNotifications')}
        />
        <Panel style={{ marginTop: space.sm, paddingVertical: space.xs }}>
          {notifications.length ? (
            notifications.map((n, i) => {
              const look = lookFor(n);
              return (
                <Pressable
                  key={n.id}
                  onPress={() => openNotification(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.title}. ${n.body}`}
                  style={({ pressed }) => [
                    styles.notifRow,
                    i > 0 && styles.memberRule,
                    webCursor,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.notifIcon, { backgroundColor: look.bg }]}>
                    <Icon name={look.icon} size={16} color={look.fg} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.notifTitleRow}>
                      <Text style={[shared.strong, !n.readAt && styles.unreadText]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.readAt ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={shared.caption} numberOfLines={1}>
                      {n.body} · {ago(n.createdAt)}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={16} color={colors.inkMuted} />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.notifEmpty}>
              <Icon name="bell" size={24} color={colors.inkMuted} />
              <Text style={[shared.caption, { marginTop: 6 }]}>All caught up on notifications</Text>
            </View>
          )}
        </Panel>
      </Rise>

      {/* ── On the wash floor (for Processing Staff or Supervisor) ── */}
      {staff.role === 'PROCESSING_STAFF' || boss ? (
        <Rise replay={replay} delay={220} distance={14}>
          <SectionHeader
            style={{ marginTop: space.xl }}
            title="On the wash floor"
            action={waitingFloor ? `${waitingFloor} waiting` : undefined}
          />
          <Panel tone="white" style={{ marginTop: space.sm }}>
            <View style={styles.floor}>
              {stageCounts.map(({ s, n }) => (
                <View
                  key={s}
                  accessibilityLabel={`${STAGE_COPY[s].label}: ${n}`}
                  style={[styles.floorCell, n > 0 && styles.floorCellOn]}
                >
                  <Icon name={STAGE_ICON[s]} size={16} color={n > 0 ? colors.ink : colors.inkMuted} />
                  <Text style={[styles.floorCount, !n && { color: colors.inkMuted }]}>{n}</Text>
                  <Text style={styles.floorLabel} numberOfLines={1}>
                    {STAGE_COPY[s].label}
                  </Text>
                </View>
              ))}
            </View>
          </Panel>
        </Rise>
      ) : null}

      {/* ── Supervisor: Needs attention ── */}
      {exc && (exc.issues.length || exc.overdue.length || exc.refused.length) ? (
        <Rise replay={replay} delay={260} distance={14}>
          <SectionHeader style={{ marginTop: space.xl }} title="Needs attention" />
          <Panel style={{ marginTop: space.sm, paddingVertical: space.xs }}>
            {exc.issues.map((i, n) => (
              <AttentionRow
                key={i.id}
                divider={n > 0}
                icon="alert"
                tone="danger"
                title={`${i.orderId} · open issue`}
                detail={i.mismatches.length ? i.mismatches.map((m) => `${m.name} ${m.received}/${m.expected}`).join(', ') : i.note}
                onPress={() => navigation.navigate('StaffOrder', { orderId: i.orderId })}
              />
            ))}
            {exc.overdue.map((o, n) => (
              <AttentionRow
                key={o.id}
                divider={n > 0 || exc.issues.length > 0}
                icon="clock"
                tone="warn"
                title={`${o.id} · past 48h turnaround`}
                detail={`Accepted ${ago(o.acceptedAt!)}`}
                onPress={() => navigation.navigate('StaffOrder', { orderId: o.id })}
              />
            ))}
            {exc.refused.length ? (
              <AttentionRow
                divider={exc.issues.length + exc.overdue.length > 0}
                icon="scan"
                tone="warn"
                title={`${plural(exc.refused.length, 'QR code')} refused today`}
                detail={exc.refused[0].message}
                onPress={() => navigation.navigate('StaffOrder', { orderId: exc.refused[0].orderId })}
              />
            ) : null}
          </Panel>
        </Rise>
      ) : null}

      {/* ── Supervisor: Team workload ── */}
      {boss && team.length ? (
        <Rise replay={replay} delay={300} distance={16}>
          <SectionHeader style={{ marginTop: space.xl }} title="Team workload" />
          <Panel style={{ marginTop: space.sm, paddingVertical: space.xs }}>
            {team.map((w, i) => (
              <View key={w.staff.id} style={[styles.member, i > 0 && styles.memberRule]}>
                <Avatar name={w.staff.name} size={36} />
                <View style={styles.flex}>
                  <Text style={shared.strong}>{w.staff.name}</Text>
                  <Text style={shared.caption}>{STAFF_ROLE_LABEL[w.staff.role]}</Text>
                </View>
                <View style={styles.memberCount}>
                  <Text style={styles.memberNum}>{w.open}</Text>
                  <Text style={styles.memberUnit}>open</Text>
                </View>
              </View>
            ))}
          </Panel>
          <Text style={[shared.caption, { marginTop: space.sm }]}>
            Assign an order from its page: open it and choose “Assign”.
          </Text>
        </Rise>
      ) : null}
    </StaffPage>
  );
}

function Tile({
  onPress,
  label,
  style,
  children,
}: {
  onPress: () => void;
  label: string;
  style?: object | object[];
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [style, webCursor, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {children}
    </Pressable>
  );
}

function AttentionRow({
  icon,
  tone,
  title,
  detail,
  onPress,
  divider,
}: {
  icon: IconName;
  tone: 'danger' | 'warn';
  title: string;
  detail: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.notifRow, divider && styles.memberRule, webCursor, pressed && { opacity: 0.7 }]}>
      <View style={[styles.notifIcon, { backgroundColor: tone === 'danger' ? colors.dangerTint : '#FFF4D9' }]}>
        <Icon name={icon} size={16} color={tone === 'danger' ? colors.danger : '#B97800'} />
      </View>
      <View style={styles.flex}>
        <Text style={shared.strong} numberOfLines={1}>
          {title}
        </Text>
        <Text style={shared.caption} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  greeting: {
    marginTop: space.lg,
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  hello: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  shift: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    flexShrink: 1,
  },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  shiftLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  shiftText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, letterSpacing: -0.3, color: colors.ink },

  /* ── Yellow Scan QR Hero Box ── */
  scanHero: {
    backgroundColor: HERO_YELLOW,
    borderRadius: 24,
    padding: 16,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.12)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(230, 140, 20, 0.12)' } as object)
      : { shadowColor: '#E68C14', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  scanHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scanTile: {
    width: 64,
    height: 64,
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
  scanAim: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  scanCorner: { position: 'absolute', width: 11, height: 11, borderColor: colors.orange },
  tl: { top: 0, left: 0, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 4 },
  scanAimIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF6D6', alignItems: 'center', justifyContent: 'center' },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  scanLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  scanHeroTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.3, color: NAVY },
  scanHeroSub: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: 'rgba(10, 28, 62, 0.72)', marginTop: 3 },
  scanBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  scanOpenBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: NAVY,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.25)' } as object) : null),
  },
  scanOpenBtnText: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.1, color: '#FFFFFF' },
  scanTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.1)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(10, 28, 62, 0.05)' } as object) : null),
  },
  scanTypeBtnText: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.1, color: NAVY },

  /* 4-card Overview Hub */
  gridWrap: { gap: 9, marginBottom: space.sm },
  heroCard: {
    backgroundColor: '#0A1C3E',
    borderRadius: 24,
    padding: 18,
    minHeight: 154,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'space-between',
    ...soft,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#FFFFFF' },
  tabsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  taskTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  taskTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabDot: { width: 5, height: 5, borderRadius: 2.5 },
  taskTabText: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255, 255, 255, 0.65)' },
  taskTabTextActive: { fontFamily: fonts.semibold, color: '#FFFFFF' },

  heroBody: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bigNum: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 42, letterSpacing: -1.4, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  bigCaption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 1, color: 'rgba(255, 255, 255, 0.66)' },
  leadTask: { alignItems: 'flex-end', gap: 8, flexShrink: 1, maxWidth: '68%' },
  leadTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leadText: { flexShrink: 1, alignItems: 'flex-end' },
  leadSub: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: 'rgba(255, 255, 255, 0.66)' },
  leadTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  leadActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  leadActionBtnUrgent: { backgroundColor: colors.orange },
  segTrack: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  segBar: { width: 14, height: 4, borderRadius: 2 },
  segBarCurrent: { width: 22 },

  emptyHeroRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allCaughtUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  allCaughtUpText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },

  pairRow: { flexDirection: 'row', gap: 9 },
  pairTile: {
    flex: 1,
    height: 116,
    justifyContent: 'space-between',
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#D4D8E0',
    ...soft,
  },
  pairTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pairTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: '#F4F2EE',
  },
  pairTagText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink },
  pairIconDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F4F2EE', alignItems: 'center', justifyContent: 'center' },
  pairNum: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  pairCaption: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },

  /* ── Salary Tile (Wallet Orange) ── */
  salaryTile: {
    backgroundColor: '#FFA742',
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(240, 130, 20, 0.18)' } as object)
      : { shadowColor: '#FFA742', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 2 }),
  },
  salaryTag: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salaryTagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  salaryGoDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0A1C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salaryNum: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  salaryCaption: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: 'rgba(10, 28, 62, 0.72)',
    marginTop: 2,
  },

  /* Perks - strictly 1 line */
  perks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  perkText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: -0.2,
    color: colors.inkSoft,
  },
  perkSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CFC8BA',
  },

  /* Notifications */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadText: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
  notifEmpty: {
    paddingVertical: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Wash Floor */
  floor: { flexDirection: 'row', gap: 6 },
  floorCell: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: space.md, borderRadius: 14, backgroundColor: CHIP },
  floorCellOn: { backgroundColor: '#F1EDE4' },
  floorCount: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  floorLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.inkSoft },

  /* Supervisor Workload */
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  memberRule: { borderTopWidth: 1, borderTopColor: RULE },
  memberCount: { alignItems: 'flex-end' },
  memberNum: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  memberUnit: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
});
