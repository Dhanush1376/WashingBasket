import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon, type IconName } from '../../components/app/Icon';
import { Rise, useFocusReplay } from '../../components/app/motion';
import { Avatar } from '../../components/app/primitives';
import { EmptyState, Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { STAFF_ROLE_LABEL } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { ago, plural, time } from '../../lib/format';
import { PROCESSING_STAGES, STAGE_COPY } from '../../mock/engine/lifecycle';
import type { StaffTabProps } from '../../navigation/types';
import { useSession } from '../../session/session';
import { branchOrders, doneToday, exceptions, isSupervisor, matchesFilter, ROLE, STAGE_ICON, tasksFor, workload, type QuickActionId } from '../../staff/work';
import { announcementsFor, checkIn, checkInState, dayKey, hhmmLabel, recordFor, type Announcement } from '../../staff/workforce';
import { colors, fonts, space } from '../../theme';
import { BEIGE, Button, CHIP, EDGE, OrderCard, Panel, RADIUS, RULE, SectionTitle, shared, soft, StaffPage, Tag, useOrderAction, useStaff, webCursor } from './kit';

const QUICK_ICON: Record<QuickActionId, IconName> = { scan: 'scan', incoming: 'inbox', progress: 'droplet', ready: 'package', assigned: 'user' };

/**
 * My workspace: who and where I am, whether I'm on shift, the numbers that tell me how the day is going, my
 * next steps (each with its button), and — for supervisors — what needs a look. Actions first, statistics second.
 */
/** A fresh value each time the scanner is opened, so it starts clean. */
const stamp = () => Date.now();

export function StaffHomeScreen({ navigation }: StaffTabProps<'StaffHome'>) {
  const replay = useFocusReplay();
  const { state, me, wf, prefs } = useStaff();
  const { signOut } = useSession();
  const action = useOrderAction(me?.staff.id);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [open, setOpen] = useState<Announcement | null>(null);

  const tasks = useMemo(() => (state && me ? tasksFor(state, me.staff) : []), [state, me]);

  if (!state || !me) {
    return (
      <StaffPage title="Washing Basket" bell={false}>
        {state && !me ? (
          <EmptyState icon="user" title="Staff account not found" message="Sign in again with the staff number and your branch’s PIN code." action={{ label: 'Sign out', onPress: signOut }} />
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
  const open_ = orders.filter((o) => matchesFilter(o, 'all', staff) && !['DELIVERED', 'REJECTED'].includes(o.status));
  const assigned = orders.filter((o) => matchesFilter(o, 'assigned', staff)).length;
  const done = doneToday(state, staff);
  const total = done + tasks.length;
  const progress = total ? done / total : 0;
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

  const doCheckIn = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      await checkIn(staff);
      haptic.success();
    } catch (e) {
      haptic.error();
      setCheckError(e instanceof Error ? e.message : 'Couldn’t check in.');
    } finally {
      setChecking(false);
    }
  };

  const quick = (id: QuickActionId) => {
    haptic.tap();
    if (id === 'scan') navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() });
    else navigation.navigate('StaffOrders', { filter: id });
  };

  const news = prefs.announcements ? announcementsFor(staff).slice(0, 2) : [];
  const stageCounts = PROCESSING_STAGES.map((s) => ({ s, n: orders.filter((o) => o.status === 'PROCESSING' && (o.processingStage ?? 'WASHING') === s).length }));
  const waitingFloor = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PICKUP_CONFIRMED').length;
  const exc = boss ? exceptions(state, staff) : null;
  const team = boss ? workload(state, staff).filter((w) => w.staff.id !== staff.id) : [];

  return (
    <StaffPage title={location.shortName} subtitle={`${STAFF_ROLE_LABEL[staff.role]} · ${location.city}`} dot={onShift ? '#22A04B' : colors.inkMuted}>
      {/* greeting, with the shift on the other side */}
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

      {/* not checked in yet on a working day: the one thing to do first */}
      {plan?.kind === 'WORK' && !rec ? (
        <Rise replay={replay} delay={40} distance={10}>
          <View style={styles.checkIn}>
            <View style={styles.checkIcon}>
              <Icon name="clock" size={18} color={colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text style={shared.strong}>You haven’t checked in</Text>
              <Text style={shared.caption}>
                {checkError ?? (shift?.can ? `${plan.shift.label} · ${hhmmLabel(plan.shift.start)} – ${hhmmLabel(plan.shift.end)}` : shift?.reason)}
              </Text>
            </View>
            <Pressable
              onPress={doCheckIn}
              disabled={checking || !shift?.can}
              accessibilityRole="button"
              accessibilityLabel="Check in"
              style={({ pressed }) => [styles.checkBtn, !shift?.can && { opacity: 0.45 }, webCursor, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Text style={styles.checkBtnText}>{checking ? '…' : 'Check in'}</Text>
            </Pressable>
          </View>
        </Rise>
      ) : null}

      {/* today, at a glance: what's waiting on me (large), and how the day is going */}
      <Rise replay={replay} delay={80} distance={16} scale={0.97} style={styles.tiles}>
        <Tile flex={1.25} style={styles.todo} label={`${plural(tasks.length, 'thing')} to do. Open orders`} onPress={() => navigation.navigate('StaffOrders', { filter: role.start })}>
          <View style={styles.tileHead}>
            <Text style={styles.todoKicker}>Pending actions</Text>
            <View style={styles.arrowDark}>
              <Icon name="arrowUpRight" size={16} color="#FFFFFF" strokeWidth={2} />
            </View>
          </View>
          <View>
            <Text style={styles.todoCount}>{tasks.length}</Text>
            <Text style={styles.todoNext} numberOfLines={2}>
              {tasks[0] ? `Next: ${tasks[0].action.label} · ${tasks[0].order.id}` : 'You’re all caught up'}
            </Text>
          </View>
        </Tile>
        <Tile flex={1} style={styles.today} label="Today’s progress" onPress={() => navigation.navigate('StaffOrders', { filter: 'all' })}>
          <View style={styles.tileHead}>
            <Text style={styles.cardKicker}>Today</Text>
            <View style={styles.arrowLight}>
              <Icon name="arrowUpRight" size={16} color={colors.ink} strokeWidth={2} />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Stat color="#62D487" label="Completed" value={done} />
            <Stat color="#54B6F8" label="Assigned" value={assigned} />
            <Stat color="#FFA742" label="Branch open" value={open_.length} />
          </View>
          <View>
            <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total || 1, now: done }}>
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.barText}>{total ? `${done} of ${total} done` : 'Nothing yet today'}</Text>
          </View>
        </Tile>
      </Rise>

      {/* the job's shortcuts */}
      <Rise replay={replay} delay={140} distance={14}>
        <View style={styles.quickPanel}>
          {role.quick.map((q) => (
            <Pressable key={q.id} onPress={() => quick(q.id)} accessibilityRole="button" accessibilityLabel={q.label} style={({ pressed }) => [styles.quick, webCursor, pressed && { transform: [{ scale: 0.95 }] }]}>
              <View style={[styles.quickIcon, q.id === 'scan' && styles.quickScan]}>
                <Icon name={QUICK_ICON[q.id]} size={19} color={q.id === 'scan' ? '#FFFFFF' : colors.ink} strokeWidth={q.id === 'scan' ? 2.2 : 1.9} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {q.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Rise>

      {/* the wash floor's board, for the people who run it */}
      {staff.role === 'PROCESSING_STAFF' || boss ? (
        <Rise replay={replay} delay={180} distance={14}>
          <Panel tone="beige">
            <View style={styles.floorHead}>
              <Text style={shared.kicker}>On the wash floor</Text>
              {waitingFloor ? <Tag label={`${waitingFloor} waiting to start`} tone="warn" /> : null}
            </View>
            <View style={styles.floor}>
              {stageCounts.map(({ s, n }) => (
                <Pressable key={s} onPress={() => navigation.navigate('StaffOrders', { filter: 'progress' })} accessibilityRole="button" accessibilityLabel={`${STAGE_COPY[s].label}: ${n}`} style={[styles.floorCell, n > 0 && styles.floorCellOn, webCursor]}>
                  <Icon name={STAGE_ICON[s]} size={15} color={n > 0 ? colors.ink : colors.inkMuted} />
                  <Text style={[styles.floorCount, !n && { color: colors.inkMuted }]}>{n}</Text>
                  <Text style={styles.floorLabel} numberOfLines={1}>
                    {STAGE_COPY[s].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        </Rise>
      ) : null}

      {/* supervisor: what needs a look */}
      {exc && (exc.issues.length || exc.overdue.length || exc.refused.length) ? (
        <Rise replay={replay} delay={200} distance={14}>
          <SectionTitle title="Needs attention" />
          <Panel style={{ paddingVertical: space.xs }}>
            {exc.issues.map((i, n) => (
              <AttentionRow key={i.id} divider={n > 0} icon="alert" tone="danger" title={`${i.orderId} · open issue`} detail={i.mismatches.length ? i.mismatches.map((m) => `${m.name} ${m.received}/${m.expected}`).join(', ') : i.note} onPress={() => navigation.navigate('StaffOrder', { orderId: i.orderId })} />
            ))}
            {exc.overdue.map((o, n) => (
              <AttentionRow key={o.id} divider={n > 0 || exc.issues.length > 0} icon="clock" tone="warn" title={`${o.id} · past 48h turnaround`} detail={`Accepted ${ago(o.acceptedAt!)}`} onPress={() => navigation.navigate('StaffOrder', { orderId: o.id })} />
            ))}
            {exc.refused.length ? (
              <AttentionRow divider={exc.issues.length + exc.overdue.length > 0} icon="scan" tone="warn" title={`${plural(exc.refused.length, 'QR code')} refused today`} detail={exc.refused[0].message} onPress={() => navigation.navigate('StaffOrder', { orderId: exc.refused[0].orderId })} />
            ) : null}
          </Panel>
        </Rise>
      ) : null}

      {/* my next steps */}
      <Rise replay={replay} delay={220} distance={16}>
        <SectionTitle title="My tasks" action={tasks.length > 3 ? 'View all' : undefined} onAction={() => navigation.navigate('StaffOrders', { filter: role.start })} />
        {action.error ? (
          <Text style={[shared.error, { marginTop: space.sm }]} accessibilityRole="alert">
            {action.error.message}
          </Text>
        ) : null}
        <View style={{ gap: space.md, marginTop: space.md }}>
          {tasks.length ? (
            tasks.slice(0, 3).map((t) => (
              <OrderCard key={t.order.id} order={t.order} state={state} me={staff} due={t.due} urgent={t.urgent} busy={action.busy === t.order.id} onOpen={() => navigation.navigate('StaffOrder', { orderId: t.order.id })} onAction={(a) => action.run(t.order, a)} />
            ))
          ) : (
            <Panel>
              <EmptyState icon="check" title="You’re all caught up" message={staff.role === 'PROCESSING_STAFF' ? 'New orders appear here as soon as the counter accepts them.' : 'New orders and handovers for you will appear here.'} />
            </Panel>
          )}
        </View>
      </Rise>

      {/* supervisor: who's carrying what */}
      {boss && team.length ? (
        <Rise replay={replay} delay={260} distance={16}>
          <SectionTitle title="Team workload" />
          <Panel style={{ paddingVertical: space.xs }}>
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
          <Text style={[shared.caption, { marginTop: space.sm }]}>Assign an order from its page: open it and choose “Assign”.</Text>
        </Rise>
      ) : null}

      {/* announcements, quietly at the end */}
      {news.length ? (
        <Rise replay={replay} delay={300} distance={16}>
          <SectionTitle title="Announcements" />
          <Panel style={{ paddingVertical: space.xs }}>
            {news.map((a, i) => (
              <Pressable key={a.id} onPress={() => setOpen(a)} accessibilityRole="button" style={({ pressed }) => [styles.news, i > 0 && styles.memberRule, webCursor, pressed && { opacity: 0.7 }]}>
                <View style={styles.newsIcon}>
                  <Icon name="megaphone" size={16} color={a.pinned ? colors.logoOrange : colors.ink} />
                </View>
                <View style={styles.flex}>
                  <Text style={shared.strong} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text style={shared.caption} numberOfLines={1}>
                    {a.kind === 'branch' ? location.shortName : 'Washing Basket'} · {ago(a.publishedAt)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color={colors.inkMuted} />
              </Pressable>
            ))}
          </Panel>
        </Rise>
      ) : null}

      <BottomSheet visible={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View>
            <Tag label={open.kind === 'branch' ? `${location.shortName} branch` : 'Company'} tone={open.kind === 'branch' ? 'navy' : 'chip'} />
            <Text style={[shared.h1, { marginTop: space.md }]}>{open.title}</Text>
            <Text style={[shared.caption, { marginTop: 4 }]}>
              {open.author} · {ago(open.publishedAt)}
            </Text>
            <Text style={[shared.body, { marginTop: space.lg }]}>{open.body}</Text>
            <Button label="Done" variant="dark" onPress={() => setOpen(null)} style={{ marginTop: space.xl }} />
          </View>
        ) : null}
      </BottomSheet>
    </StaffPage>
  );
}

/** A card that sinks slightly under the finger (Profile's tiles). */
function Tile({ onPress, flex, style, label, children }: { onPress: () => void; flex: number; style: object; label: string; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => s.set(withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => s.set(withSpring(1, { damping: 16, stiffness: 260 }))}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[{ flex }, webCursor]}
    >
      <Animated.View style={[style, { flex: 1 }, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function AttentionRow({ icon, tone, title, detail, onPress, divider }: { icon: IconName; tone: 'danger' | 'warn'; title: string; detail: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.news, divider && styles.memberRule, webCursor, pressed && { opacity: 0.7 }]}>
      <View style={[styles.newsIcon, { backgroundColor: tone === 'danger' ? colors.dangerTint : '#FFF4D9' }]}>
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
  greeting: { marginTop: space.md, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  hello: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.8, color: colors.ink },
  shift: { alignItems: 'flex-end', paddingBottom: 4, flexShrink: 1 },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  shiftLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  shiftText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, letterSpacing: -0.3, color: colors.ink },

  checkIn: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingLeft: space.lg, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: EDGE, ...soft },
  checkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1DF', alignItems: 'center', justifyContent: 'center' },
  checkBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  checkBtnText: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#FFFFFF' },

  tiles: { flexDirection: 'row', gap: space.md },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todo: { minHeight: 188, borderRadius: RADIUS, backgroundColor: colors.orange, padding: space.lg, justifyContent: 'space-between' },
  todoKicker: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(10, 28, 62, 0.72)' },
  todoCount: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 50, letterSpacing: -1.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  todoNext: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.ink },
  arrowDark: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  arrowLight: { width: 32, height: 32, borderRadius: 16, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  today: { minHeight: 188, borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, justifyContent: 'space-between', borderWidth: 1, borderColor: EDGE, ...soft },
  cardKicker: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkSoft },
  statValue: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3, backgroundColor: CHIP, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#12AD2B' },
  barText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkMuted, marginTop: 6 },

  quickPanel: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: RADIUS, paddingVertical: space.lg, paddingHorizontal: space.sm, borderWidth: 1, borderColor: EDGE, ...soft },
  quick: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  quickScan: { backgroundColor: colors.ink },
  quickLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },

  floorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, minHeight: 24 },
  floor: { flexDirection: 'row', gap: 6 },
  floorCell: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: space.md, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  floorCellOn: { backgroundColor: '#FFFFFF' },
  floorCount: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  floorLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.inkSoft },

  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  memberRule: { borderTopWidth: 1, borderTopColor: RULE },
  memberCount: { alignItems: 'flex-end' },
  memberNum: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  memberUnit: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },

  news: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  newsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' },
});
