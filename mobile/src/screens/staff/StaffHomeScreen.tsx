import React, { useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ART, ART_TINT } from '../../components/app/art';
import { Icon, type IconName } from '../../components/app/Icon';
import { Rise, useFocusReplay } from '../../components/app/motion';
import { Avatar, SectionHeader } from '../../components/app/primitives';
import { EmptyState, Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { STAFF_ROLE_LABEL } from '../../laundry/labels';
import { ago, plural, time } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { PROCESSING_STAGES, STAGE_COPY } from '../../mock/engine/lifecycle';
import { findCustomer } from '../../mock/engine/selectors';
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
  tasksFor,
  workload,
} from '../../staff/work';
import {
  announcementsFor,
  checkIn,
  checkInState,
  dayKey,
  hhmmLabel,
  recordFor,
  type Announcement,
} from '../../staff/workforce';
import { colors, fonts, space } from '../../theme';
import {
  BEIGE,
  Button,
  CHIP,
  EDGE,
  OrderCard,
  Panel,
  RADIUS,
  RULE,
  shared,
  soft,
  StaffPage,
  Tag,
  useOrderAction,
  useStaff,
  webCursor,
} from './kit';

/** A fresh value each time the scanner is opened, so it starts clean. */
const stamp = () => Date.now();

const PERKS = [
  { icon: 'clock', label: '48h turnaround SLA', tint: colors.orange },
  { icon: 'scan', label: 'Verified piece counts', tint: colors.navy },
  { icon: 'shield', label: 'Digital audit trail', tint: '#12AD2B' },
] as const;

export function StaffHomeScreen({ navigation }: StaffTabProps<'StaffHome'>) {
  const replay = useFocusReplay();
  const { state, me, wf, prefs } = useStaff();
  const { signOut } = useSession();
  const action = useOrderAction(me?.staff.id);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [open, setOpen] = useState<Announcement | null>(null);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);

  const tasks = useMemo(() => (state && me ? tasksFor(state, me.staff) : []), [state, me]);

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

  const news = prefs.announcements ? announcementsFor(staff).slice(0, 2) : [];
  const stageCounts = PROCESSING_STAGES.map((s) => ({
    s,
    n: orders.filter((o) => o.status === 'PROCESSING' && (o.processingStage ?? 'WASHING') === s).length,
  }));
  const waitingFloor = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PICKUP_CONFIRMED').length;
  const exc = boss ? exceptions(state, staff) : null;
  const team = boss ? workload(state, staff).filter((w) => w.staff.id !== staff.id) : [];

  const activeTaskIdx = Math.max(0, Math.min(selectedTaskIdx, Math.max(0, tasks.length - 1)));
  const currentTask = tasks[activeTaskIdx];
  const currentCustomer = currentTask ? findCustomer(state, currentTask.order.customerId) : null;

  const TOOLS = [
    {
      art: 'collecting',
      tint: ART_TINT.collecting,
      title: 'Intake Scanner',
      meta: 'Drop-off & tag',
      onPress: () => navigation.navigate('StaffScan', { intent: 'INTAKE', nonce: stamp() }),
    },
    {
      art: 'washing',
      tint: ART_TINT.washing,
      title: 'Wash Floor',
      meta: `${stageCounts.reduce((acc, c) => acc + c.n, 0)} orders cycling`,
      onPress: () => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() }),
    },
    {
      art: 'ironing',
      tint: ART_TINT.ironing,
      title: 'Press & Pack',
      meta: 'Steam & verify',
      onPress: () => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() }),
    },
    {
      art: 'delivery',
      tint: ART_TINT.delivery,
      title: 'Handover QR',
      meta: 'Customer pickup',
      onPress: () => navigation.navigate('StaffScan', { intent: 'DELIVERY', nonce: stamp() }),
    },
  ];

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

      {/* ── Check-in banner (when working today but not checked in) ── */}
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

      {/* ── 4-Card Overview Hub (Customer OverviewGrid layout) ── */}
      <Rise replay={replay} delay={70} distance={16} scale={0.97}>
        <View style={styles.gridWrap}>
          {/* Navy #0A1C3E Lead Card */}
          <View style={styles.heroCard}>
            <View style={styles.topRow}>
              <View style={styles.tagBadge}>
                <View
                  style={[
                    styles.tagDot,
                    { backgroundColor: tasks.length ? colors.orange : '#12AD2B' },
                  ]}
                />
                <Text style={styles.tagText}>
                  {tasks.length ? 'Pending actions' : 'Shift active'}
                </Text>
              </View>

              {/* Multi-task tab switcher */}
              {tasks.length > 1 ? (
                <View style={styles.tabsRow}>
                  {tasks.slice(0, 3).map((t, idx) => {
                    const isSelected = idx === activeTaskIdx;
                    return (
                      <Pressable
                        key={t.order.id}
                        onPress={() => {
                          haptic.tap();
                          setSelectedTaskIdx(idx);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Switch to task for order ${t.order.id}`}
                        style={[styles.taskTab, isSelected && styles.taskTabActive, webCursor]}
                      >
                        <View
                          style={[
                            styles.tabDot,
                            { backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
                          ]}
                        />
                        <Text style={[styles.taskTabText, isSelected && styles.taskTabTextActive]}>
                          #{t.order.id.slice(-4)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {/* Hero Body */}
            {currentTask ? (
              <View style={styles.heroBody}>
                <Pressable
                  onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
                  accessibilityRole="button"
                  accessibilityLabel={`${tasks.length} pending actions. Open scanner`}
                  hitSlop={8}
                  style={webCursor}
                >
                  <Text style={styles.bigNum}>{tasks.length}</Text>
                  <Text style={styles.bigCaption}>
                    {tasks.length === 1 ? 'Pending action' : 'Pending actions'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (currentTask.action.kind.startsWith('scan')) {
                      navigation.navigate('StaffScan', {
                        intent: currentTask.action.kind === 'scan-intake' ? 'INTAKE' : 'DELIVERY',
                        orderId: currentTask.order.id,
                        nonce: stamp(),
                      });
                    } else {
                      navigation.navigate('StaffOrder', { orderId: currentTask.order.id });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${currentTask.action.label}. Order ${currentTask.order.id}`}
                  style={[styles.leadTask, webCursor]}
                >
                  <View style={styles.leadTop}>
                    <View style={styles.leadText}>
                      <Text style={styles.leadSub} numberOfLines={1}>
                        #{currentTask.order.id} · {currentCustomer?.name ? currentCustomer.name.split(' ')[0] : 'Customer'}
                      </Text>
                      <Text style={styles.leadTitle} numberOfLines={1} adjustsFontSizeToFit>
                        {currentTask.action.label}
                      </Text>
                    </View>
                    <View style={[styles.leadActionBtn, currentTask.urgent && styles.leadActionBtnUrgent]}>
                      <Icon
                        name={currentTask.action.icon ?? 'arrowUpRight'}
                        size={17}
                        color="#FFFFFF"
                        strokeWidth={2.2}
                      />
                    </View>
                  </View>

                  {/* Segmented stage progress line */}
                  <View style={styles.segTrack} accessibilityElementsHidden>
                    {[0, 1, 2, 3, 4].map((stepIdx) => {
                      const stageNow =
                        currentTask.order.status === 'PROCESSING'
                          ? 2
                          : currentTask.order.status === 'READY_FOR_DELIVERY'
                            ? 3
                            : currentTask.order.status === 'ACCEPTED'
                              ? 1
                              : 0;
                      return (
                        <View
                          key={stepIdx}
                          style={[
                            styles.segBar,
                            stepIdx === stageNow && styles.segBarCurrent,
                            {
                              backgroundColor:
                                stepIdx < stageNow
                                  ? colors.orange
                                  : stepIdx === stageNow
                                    ? '#FFFFFF'
                                    : 'rgba(255,255,255,0.22)',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyHeroRow}>
                <View>
                  <Text style={styles.bigNum}>0</Text>
                  <Text style={styles.bigCaption}>Pending actions</Text>
                </View>
                <View style={styles.allCaughtUpBadge}>
                  <Icon name="check" size={16} color="#12AD2B" strokeWidth={2.4} />
                  <Text style={styles.allCaughtUpText}>All caught up</Text>
                </View>
              </View>
            )}
          </View>

          {/* Bottom Pair: Completed Today & Branch Floor Queue */}
          <View style={styles.pairRow}>
            {/* Completed Today Tile */}
            <Tile
              onPress={() => haptic.tap()}
              label={`Completed today: ${done} orders`}
              style={styles.pairTile}
            >
              <View style={styles.pairTop}>
                <View style={styles.pairTag}>
                  <View style={[styles.tagDot, { backgroundColor: '#12AD2B' }]} />
                  <Text style={styles.pairTagText}>Completed</Text>
                </View>
                <View style={styles.pairIconDot}>
                  <Icon name="check" size={13} color="#12AD2B" strokeWidth={2.4} />
                </View>
              </View>
              <View>
                <Text style={styles.pairNum}>{done}</Text>
                <View
                  style={styles.pairMiniTrack}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: total || 1, now: done }}
                >
                  <View style={[styles.pairMiniFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <Text style={styles.pairCaption} numberOfLines={1}>
                  {total ? `${done} of ${total} done` : 'Shift in progress'}
                </Text>
              </View>
            </Tile>

            {/* Branch Floor Queue Tile */}
            <Tile
              onPress={() => haptic.tap()}
              label={`Branch floor queue: ${open_.length} orders`}
              style={styles.pairTile}
            >
              <View style={styles.pairTop}>
                <View style={styles.pairTag}>
                  <View style={[styles.tagDot, { backgroundColor: colors.navy }]} />
                  <Text style={styles.pairTagText}>Branch Floor</Text>
                </View>
                <View style={styles.pairIconDot}>
                  <Icon name="inbox" size={13} color={colors.inkSoft} strokeWidth={2} />
                </View>
              </View>
              <View>
                <Text style={styles.pairNum}>{open_.length}</Text>
                <Text style={styles.pairCaption} numberOfLines={1}>
                  {waitingFloor ? `${waitingFloor} waiting floor` : `${assigned} assigned to you`}
                </Text>
              </View>
            </Tile>
          </View>
        </View>
      </Rise>

      {/* ── Perks Bar (Customer style 3-point divider row) ── */}
      <Rise replay={replay} delay={140} distance={8}>
        <View
          style={styles.perks}
          accessibilityRole="text"
          accessibilityLabel="48 hour turnaround SLA, verified piece count, digital audit trail"
        >
          {PERKS.map((k, i) => (
            <React.Fragment key={k.label}>
              {i ? <View style={styles.perkSep} /> : null}
              <View style={styles.perk}>
                <Icon name={k.icon} size={15} color={k.tint} strokeWidth={2} />
                <Text style={styles.perkText}>{k.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Rise>

      {/* ── Quick QR Intake Hero Card (Customer "Fresh clothes" booking card style) ── */}
      <Rise replay={replay} delay={190} distance={16} scale={0.98}>
        <Pressable
          onPress={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
          accessibilityRole="button"
          accessibilityLabel="Counter & Intake. Scan QR code, verify and bag. Open scanner"
          style={({ pressed }) => [
            styles.bookingCard,
            webCursor,
            pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
          ]}
        >
          <View style={styles.bookingHalo} />
          <Image
            source={ART.steam}
            style={styles.bookingArt}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.bookingBody}>
            <View style={styles.bookingKicker}>
              <View style={styles.bookingDot} />
              <Text style={styles.bookingKickerText}>Counter & Intake</Text>
            </View>
            <Text style={styles.bookingTitle}>
              Scan QR code,{'\n'}verify & bag
            </Text>
            <View style={styles.bookingCta}>
              <Text style={styles.bookingCtaText}>Open scanner</Text>
              <Icon name="arrowRight" size={14} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </View>
        </Pressable>
      </Rise>

      {/* ── Tools & Shortcuts Strip (Customer servicesRow horizontal scroll) ── */}
      <Rise replay={replay} delay={240} distance={16}>
        <SectionHeader
          title="Staff shortcuts"
          action="Scanner"
          onAction={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
        />
      </Rise>

      <Rise replay={replay} delay={280} distance={16}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolsRow}
        >
          {TOOLS.map((t) => (
            <Pressable
              key={t.title}
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}, ${t.meta}`}
              style={({ pressed }) => [
                styles.toolCard,
                webCursor,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[styles.toolArt, { backgroundColor: t.tint }]}>
                <Image source={ART[t.art]} style={styles.fill} resizeMode="cover" />
              </View>
              <Text style={styles.toolName} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.toolMeta} numberOfLines={1}>
                {t.meta}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Rise>

      {/* ── My Tasks (Customer Recent Orders style) ── */}
      <Rise replay={replay} delay={320} distance={16}>
        <SectionHeader
          style={{ marginTop: space.sm }}
          title="My tasks"
          action={tasks.length > 3 ? `${tasks.length} total` : undefined}
          onAction={() => navigation.navigate('StaffScan', { intent: 'ANY', nonce: stamp() })}
        />
        {action.error ? (
          <Text style={[shared.error, { marginTop: space.sm }]} accessibilityRole="alert">
            {action.error.message}
          </Text>
        ) : null}
        <View style={{ gap: space.md, marginTop: space.md }}>
          {tasks.length ? (
            tasks.slice(0, 3).map((t) => (
              <OrderCard
                key={t.order.id}
                order={t.order}
                state={state}
                me={staff}
                due={t.due}
                urgent={t.urgent}
                busy={action.busy === t.order.id}
                onOpen={() => navigation.navigate('StaffOrder', { orderId: t.order.id })}
                onAction={(a) => action.run(t.order, a)}
              />
            ))
          ) : (
            <Panel>
              <EmptyState
                icon="check"
                title="You’re all caught up"
                message={
                  staff.role === 'PROCESSING_STAFF'
                    ? 'New orders appear here as soon as the counter accepts them.'
                    : 'New orders and handovers for you will appear here.'
                }
              />
            </Panel>
          )}
        </View>
      </Rise>

      {/* ── On the wash floor (for Processing Staff or Supervisor) ── */}
      {staff.role === 'PROCESSING_STAFF' || boss ? (
        <Rise replay={replay} delay={360} distance={14}>
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
        <Rise replay={replay} delay={400} distance={14}>
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
        <Rise replay={replay} delay={440} distance={16}>
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

      {/* ── Announcements ── */}
      {news.length ? (
        <Rise replay={replay} delay={480} distance={16}>
          <SectionHeader style={{ marginTop: space.xl }} title="Announcements" />
          <Panel style={{ marginTop: space.sm, paddingVertical: space.xs }}>
            {news.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => setOpen(a)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.news, i > 0 && styles.memberRule, webCursor, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.newsIcon}>
                  <Icon name="megaphone" size={16} color={a.pinned ? colors.orange : colors.ink} />
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
      style={({ pressed }) => [styles.news, divider && styles.memberRule, webCursor, pressed && { opacity: 0.7 }]}
    >
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
  fill: { width: '100%', height: '100%' },

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

  checkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingLeft: space.lg,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: EDGE,
    marginBottom: space.lg,
    ...soft,
  },
  checkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1DF', alignItems: 'center', justifyContent: 'center' },
  checkBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  checkBtnText: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#FFFFFF' },

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
  pairMiniTrack: { height: 4, borderRadius: 2, backgroundColor: '#EFECE6', overflow: 'hidden', marginTop: 4, width: '100%' },
  pairMiniFill: { height: 4, borderRadius: 2, backgroundColor: '#12AD2B' },

  /* Perks */
  perks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    letterSpacing: -0.1,
    color: colors.inkSoft,
  },
  perkSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CFC8BA',
  },

  /* Counter & Intake Booking-style Hero Card */
  bookingCard: {
    height: 172,
    borderRadius: 24,
    backgroundColor: '#F1EDE4',
    borderWidth: 1,
    borderColor: '#E3DDD0',
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  bookingHalo: {
    position: 'absolute',
    right: -44,
    bottom: -58,
    width: 252,
    height: 252,
    borderRadius: 126,
    backgroundColor: '#FFFFFF',
  },
  bookingArt: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    height: 152,
    width: 152 * (721 / 586),
    mixBlendMode: 'multiply',
  },
  bookingBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: space.lg,
    maxWidth: '58%',
  },
  bookingKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  bookingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
  bookingKickerText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.ink,
  },
  bookingTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  bookingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#0A1C3E',
  },
  bookingCtaText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  /* Tools & Shortcuts */
  toolsRow: {
    paddingRight: space.lg,
    gap: space.md,
    paddingVertical: space.xs,
    paddingBottom: space.lg,
  },
  toolCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: EDGE,
    ...soft,
  },
  toolArt: {
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  toolName: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.ink,
    paddingHorizontal: 2,
  },
  toolMeta: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.inkSoft,
    paddingHorizontal: 2,
    marginTop: 1,
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

  /* Announcements */
  news: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  newsIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' },
});
