import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../../components/app/Icon';
import { Rise, useFocusReplay } from '../../components/app/motion';
import { Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { OptionChip, PillTextArea } from '../../components/ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { plural, time } from '../../lib/format';
import type { Staff } from '../../mock/types';
import type { StaffTabProps } from '../../navigation/types';
import { displayName, isSupervisor } from '../../staff/work';
import {
  attendanceOn,
  cancelLeave,
  checkIn,
  checkInState,
  checkOut,
  dayKey,
  decideLeave,
  durationLabel,
  hhmmLabel,
  isLate,
  LEAVE_TYPES,
  leaveBalance,
  leaveDays,
  monthSummary,
  planFor,
  recordFor,
  requestLeave,
  rosterFor,
  SCHEDULE,
  shiftFor,
  workedMs,
  type DayAttendance,
  type LeaveRequest,
  type LeaveType,
} from '../../staff/workforce';
import { colors, fonts, space } from '../../theme';
import { Button, CHIP, EDGE, Line, Notice, Panel, RoundIcon, SectionTitle, shared, soft, StaffPage, Tag, useStaff, webCursor } from './kit';

type WF = NonNullable<ReturnType<typeof useStaff>['wf']>;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LEAVE_ICON: Record<LeaveType, IconName> = { CASUAL: 'sun', SICK: 'shield', EARNED: 'star' };
const LEAVE_TONE: Record<LeaveRequest['status'], 'warn' | 'ok' | 'danger' | 'chip'> = { PENDING: 'warn', APPROVED: 'ok', DECLINED: 'danger', CANCELLED: 'chip' };
const LEAVE_STATUS: Record<LeaveRequest['status'], string> = { PENDING: 'Pending', APPROVED: 'Approved', DECLINED: 'Declined', CANCELLED: 'Withdrawn' };

const DOT = { PRESENT: '#12AD2B', LATE: '#E59A00', MISSED: colors.danger, LEAVE: colors.navy, HOLIDAY: colors.logoOrange } as const;

const monthOf = (day: string) => day.slice(0, 7);
const addMonth = (m: string, n: number) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const niceDay = (day: string, withYear = false) => {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
};
const range = (from: string, to: string) => (from === to ? niceDay(from) : `${niceDay(from)} – ${niceDay(to)}`);
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * My working month: today's shift with check-in and check-out, a calendar of shifts and attendance, the month's
 * totals and history, and leave — balances, requests and, for a supervisor, the branch's pending requests.
 * Check-ins made here are saved on this device; earlier attendance is labelled demo data.
 */
export function StaffScheduleScreen(_: StaffTabProps<'StaffSchedule'>) {
  const replay = useFocusReplay();
  const { state, me, wf } = useStaff();
  const today = dayKey();
  const [month, setMonth] = useState(monthOf(today));
  const [day, setDay] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [allHistory, setAllHistory] = useState(false);

  if (!wf || !me || !state) {
    return (
      <StaffPage title="Schedule">
        <View style={{ gap: space.md }}>
          <Skeleton height={150} radius={26} />
          <Skeleton height={340} radius={26} />
        </View>
      </StaffPage>
    );
  }
  const st = me.staff;
  const shift = shiftFor(st.id);
  const sum = monthSummary(wf, st, month, today);
  const history = wf.attendance.filter((a) => a.staffId === st.id && monthOf(a.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const shown = allHistory ? history : history.slice(0, 6);
  const team = state.staff.filter((s) => s.locationId === st.locationId);
  const myLeave = wf.leave.filter((r) => r.staffId === st.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const teamPending = isSupervisor(st) ? wf.leave.filter((r) => r.status === 'PENDING' && r.staffId !== st.id && team.some((t) => t.id === r.staffId)) : [];

  return (
    <StaffPage title="Schedule" subtitle={shift ? `${shift.label} · ${hhmmLabel(shift.start)} – ${hhmmLabel(shift.end)}` : me.location.shortName}>
      <Rise key={`t${replay}`}>
        <TodayCard wf={wf} st={st} />
      </Rise>

      <Rise key={`c${replay}`} delay={70}>
        <Panel tone="beige">
          <View style={styles.calHead}>
            <View style={styles.flex}>
              <Text style={styles.calKicker}>Shifts & attendance</Text>
              <Text style={styles.calMonth} accessibilityRole="header">
                {MONTHS[Number(month.slice(5)) - 1]} <Text style={styles.calYear}>{month.slice(0, 4)}</Text>
              </Text>
            </View>
            {month !== monthOf(today) ? (
              <Pressable onPress={() => setMonth(monthOf(today))} accessibilityRole="button" style={[styles.todayBtn, webCursor]}>
                <Text style={styles.todayBtnText}>Today</Text>
              </Pressable>
            ) : null}
            <RoundNav icon="chevronLeft" label="Previous month" onPress={() => setMonth((m) => addMonth(m, -1))} />
            <RoundNav icon="chevronRight" label="Next month" onPress={() => setMonth((m) => addMonth(m, 1))} />
          </View>
          <MonthGrid
            month={month}
            today={today}
            selected={day ? [day] : []}
            onPress={(d) => {
              haptic.tap();
              setDay(d);
            }}
            look={(d) => tileLook(wf, st, d, today)}
          />
          <View style={styles.legend}>
            {(
              [
                ['Worked', DOT.PRESENT],
                ['Late', DOT.LATE],
                ['Missed', DOT.MISSED],
                ['Leave', DOT.LEAVE],
                ['Holiday', DOT.HOLIDAY],
              ] as const
            ).map(([l, c]) => (
              <View key={l} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: c }]} />
                <Text style={styles.legendText}>{l}</Text>
              </View>
            ))}
          </View>
        </Panel>
      </Rise>

      <Rise key={`s${replay}`} delay={130}>
        <View style={styles.stats}>
          <Stat label="Days worked" value={`${sum.worked}`} detail={`of ${plural(sum.scheduled, 'shift')}`} />
          <Stat label="Hours" value={durationLabel(sum.hours)} detail="checked out" />
          <Stat label="Late" value={`${sum.late}`} detail={`after ${SCHEDULE.attendancePolicy.lateAfterMinutes} min`} tone={sum.late ? 'warn' : undefined} />
          <Stat label="Missed" value={`${sum.missed}`} detail="no check-in" tone={sum.missed ? 'danger' : undefined} />
        </View>
      </Rise>

      <SectionTitle title={`Attendance · ${MONTHS[Number(month.slice(5)) - 1]}`} />
      <Panel style={{ paddingVertical: space.sm }}>
        {shown.length ? (
          shown.map((r, i) => {
            const plan = planFor(wf, st, r.date);
            const late = plan.kind === 'WORK' && isLate(r, plan.shift);
            return (
              <Pressable key={r.id} onPress={() => setDay(r.date)} accessibilityRole="button" style={[styles.histRow, i > 0 && styles.histRule, webCursor]}>
                <View style={styles.histDate}>
                  <Text style={styles.histDay}>{Number(r.date.slice(8))}</Text>
                  <Text style={styles.histWeek}>{niceDay(r.date).split(',')[0]}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={shared.strong}>
                    {time(r.checkIn)} – {r.checkOut ? time(r.checkOut) : 'on shift'}
                  </Text>
                  <Text style={shared.caption}>{r.checkOut ? `${durationLabel(workedMs(r))} worked` : 'Not checked out yet'}{r.source === 'device' ? ' · this device' : ''}</Text>
                </View>
                {late ? <Tag label="Late" tone="warn" /> : r.checkOut ? <Tag label="On time" tone="ok" /> : <Tag label="Live" tone="navy" />}
              </Pressable>
            );
          })
        ) : (
          <Text style={[shared.body, { paddingVertical: space.md }]}>{month > monthOf(today) ? 'This month hasn’t started yet.' : 'No check-ins this month.'}</Text>
        )}
        {history.length > 6 ? (
          <Pressable onPress={() => setAllHistory((a) => !a)} accessibilityRole="button" style={[styles.more, webCursor]}>
            <Text style={styles.link}>{allHistory ? 'Show less' : `Show all ${history.length}`}</Text>
          </Pressable>
        ) : null}
      </Panel>
      <View style={styles.demoRow}>
        <Tag label="Demo data" tone="warn" />
        <Text style={[shared.caption, styles.flex]}>Attendance before today is sample data. Check-ins you make here are saved on this device only.</Text>
      </View>

      <SectionTitle title="Leave" />
      <View style={styles.balances}>
        {leaveBalance(wf, st.id).map((b) => (
          <View key={b.id} style={styles.balance}>
            <Icon name={LEAVE_ICON[b.id]} size={16} color={colors.navy} />
            <Text style={styles.balanceValue}>{b.left}</Text>
            <Text style={styles.balanceLabel}>{b.label}</Text>
            <Text style={shared.caption}>
              {b.used} used{b.pending ? ` · ${b.pending} pending` : ''}
            </Text>
          </View>
        ))}
      </View>
      <Button label="Request leave" icon="plus" variant="dark" onPress={() => setLeaveOpen(true)} />

      {teamPending.length ? (
        <>
          <SectionTitle title={`Team requests · ${teamPending.length}`} />
          {teamPending.map((r) => (
            <TeamRequest key={r.id} r={r} boss={st} team={team} />
          ))}
        </>
      ) : null}

      <SectionTitle title="My requests" />
      {myLeave.length ? (
        <Panel style={{ paddingVertical: space.sm }}>
          {myLeave.map((r, i) => (
            <MyRequest key={r.id} r={r} st={st} first={i === 0} team={team} />
          ))}
        </Panel>
      ) : (
        <Text style={shared.body}>No leave requests in {LEAVE_TYPES.year}.</Text>
      )}
      <Text style={shared.caption}>Your supervisor approves leave. A supervisor’s own leave goes to the admin team.</Text>

      <DaySheet wf={wf} st={st} day={day} today={today} onClose={() => setDay(null)} />
      <LeaveSheet visible={leaveOpen} wf={wf} st={st} today={today} onClose={() => setLeaveOpen(false)} />
    </StaffPage>
  );
}

/* ───────────── today ───────────── */

function TodayCard({ wf, st }: { wf: WF; st: Staff }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [, tick] = useState(0);
  const c = checkInState(wf, st);
  const rec = c.rec;
  const live = !!rec && !rec.checkOut;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [live]);
  const roster = rosterFor(st.id);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      haptic.success();
      setConfirmOut(false);
    } catch (e) {
      haptic.error();
      setError(errText(e, 'That didn’t go through. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (c.plan.kind !== 'WORK') {
    const look =
      c.plan.kind === 'HOLIDAY'
        ? { icon: 'star' as const, title: c.plan.name, body: 'Branch holiday. Enjoy the day.' }
        : c.plan.kind === 'LEAVE'
          ? { icon: 'sun' as const, title: 'On leave today', body: `${LEAVE_TYPES.types.find((t) => t.id === (c.plan as { request: LeaveRequest }).request.type)?.label ?? 'Leave'} · ${range(c.plan.request.from, c.plan.request.to)}` }
          : { icon: 'sun' as const, title: 'Day off', body: c.plan.kind === 'NONE' ? 'No shift is set up for you yet. Ask your supervisor.' : 'No shift today. See you on your next shift.' };
    return (
      <Panel>
        <View style={styles.todayTop}>
          <RoundIcon icon={look.icon} tone="orange" size={44} />
          <View style={styles.flex}>
            <Text style={shared.kicker}>Today · {niceDay(dayKey())}</Text>
            <Text style={shared.h1}>{look.title}</Text>
            <Text style={shared.body}>{look.body}</Text>
          </View>
        </View>
      </Panel>
    );
  }
  const shift = c.plan.shift;
  return (
    <Panel>
      <View style={styles.todayTop}>
        <RoundIcon icon={live ? 'clock' : rec ? 'check' : 'calendar'} tone={live ? 'ok' : rec ? 'chip' : 'orange'} size={44} />
        <View style={styles.flex}>
          <Text style={shared.kicker}>Today · {niceDay(dayKey())}</Text>
          <Text style={shared.h1}>
            {hhmmLabel(shift.start)} – {hhmmLabel(shift.end)}
          </Text>
          <Text style={shared.body}>
            {shift.label}
            {roster ? ` · ${roster.reportingPoint}` : ''}
          </Text>
        </View>
      </View>
      <View style={shared.rule} />
      {rec ? (
        <View style={styles.times}>
          <TimeBox label="Checked in" value={time(rec.checkIn)} warn={isLate(rec, shift)} />
          <TimeBox label="Checked out" value={rec.checkOut ? time(rec.checkOut) : '—'} />
          <TimeBox label={live ? 'So far' : 'Worked'} value={durationLabel(workedMs(rec))} />
        </View>
      ) : (
        <Text style={shared.body}>{c.can ? `Check in when you reach ${roster?.reportingPoint ?? 'the branch'}. Later than ${SCHEDULE.attendancePolicy.lateAfterMinutes} minutes after ${hhmmLabel(shift.start)} counts as late.` : c.reason}</Text>
      )}
      {error ? (
        <Text style={[shared.error, { marginTop: space.sm }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {!rec ? (
        <Button label="Check in" icon="check" onPress={() => run(() => checkIn(st))} loading={busy} disabled={!c.can} style={{ marginTop: space.md }} />
      ) : live ? (
        confirmOut ? (
          <View style={[styles.outRow, { marginTop: space.md }]}>
            <Button label="Not yet" variant="outline" onPress={() => setConfirmOut(false)} disabled={busy} style={styles.flex} />
            <Button label="Check out now" variant="dark" onPress={() => run(() => checkOut(st))} loading={busy} style={styles.grow} />
          </View>
        ) : (
          <Button label="Check out" icon="logout" variant="outline" onPress={() => setConfirmOut(true)} style={{ marginTop: space.md }} />
        )
      ) : (
        <Notice tone="ok" icon="check" style={{ marginTop: space.md }}>
          Shift done. Thanks for today.
        </Notice>
      )}
    </Panel>
  );
}

function TimeBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.timeBox}>
      <Text style={shared.caption}>{label}</Text>
      <Text style={[styles.timeValue, warn && { color: '#B97800' }]}>{value}</Text>
      {warn ? <Text style={[shared.caption, { color: '#B97800' }]}>Late</Text> : null}
    </View>
  );
}

/* ───────────── calendar ───────────── */

type Look = { bg: string; border: string; text: string; dot?: string; strong?: boolean; disabled?: boolean; label: string };

function tileLook(wf: WF, st: Staff, d: string, today: string): Look {
  const plan = planFor(wf, st, d);
  const a: DayAttendance = attendanceOn(wf, st, d, today);
  const isToday = d === today;
  const base = (dot: string | undefined, label: string, ahead = d > today): Look =>
    isToday
      ? { bg: colors.ink, border: colors.ink, text: '#FFFFFF', dot, strong: true, label: `Today, ${label}` }
      : ahead
        ? { bg: 'rgba(255,255,255,0.45)', border: 'rgba(255,255,255,0.65)', text: 'rgba(10,28,62,0.6)', dot, label }
        : { bg: '#FFFFFF', border: 'rgba(255,255,255,0.9)', text: colors.ink, dot, strong: true, label };
  if (plan.kind === 'NONE') return { bg: 'transparent', border: 'transparent', text: 'rgba(10,28,62,0.3)', label: 'Before you joined', disabled: true };
  if (plan.kind === 'HOLIDAY') return { ...base(DOT.HOLIDAY, `holiday, ${plan.name}`), ...(isToday ? {} : { bg: '#FFF1DF', border: '#FFE2BD' }) };
  if (plan.kind === 'LEAVE') return { ...base(DOT.LEAVE, 'on leave'), ...(isToday ? {} : { bg: '#E6EEF8', border: '#D3E0F2' }) };
  if (plan.kind === 'OFF') return { ...base(a === 'PRESENT' ? DOT.PRESENT : undefined, 'day off', true), ...(isToday ? { bg: colors.ink } : {}) };
  if (a === 'PRESENT' || a === 'ON_SHIFT') return base(DOT.PRESENT, a === 'ON_SHIFT' ? 'on shift' : 'worked');
  if (a === 'LATE') return base(DOT.LATE, 'late');
  if (a === 'MISSED') return base(DOT.MISSED, 'missed');
  return base(undefined, isToday ? 'shift, not checked in' : 'shift');
}

function MonthGrid({ month, today, selected, onPress, look, minDay }: { month: string; today: string; selected: string[]; onPress: (d: string) => void; look: (d: string) => Look; minDay?: string }) {
  const [width, setWidth] = useState(0);
  const gap = 5;
  const cell = width ? (width - gap * 6) / 7 : 0;
  const cells = useMemo(() => {
    const first = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
    for (let i = 1; i <= last; i++) out.push(`${month}-${String(i).padStart(2, '0')}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.weekdays, { gap }]}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, { width: cell || undefined, flex: cell ? undefined : 1 }]}>
            {w}
          </Text>
        ))}
      </View>
      {cell ? (
        <View style={[styles.grid, { gap }]} accessibilityLabel={monthName(month)}>
          {cells.map((d, i) => {
            if (!d) return <View key={`e${i}`} style={{ width: cell, height: cell }} />;
            const l = look(d);
            const off = l.disabled || (minDay ? d < minDay : false);
            const sel = selected.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => onPress(d)}
                disabled={off}
                accessibilityRole="button"
                accessibilityState={{ selected: sel, disabled: off }}
                accessibilityLabel={`${niceDay(d, true)}, ${l.label}`}
                style={({ pressed }) => [
                  styles.tile,
                  { width: cell, height: cell, backgroundColor: l.bg, borderColor: l.border },
                  sel && styles.tileSel,
                  off && { opacity: 0.45 },
                  pressed && { transform: [{ scale: 0.94 }] },
                  webCursor,
                ]}
              >
                <Text style={[styles.tileText, { color: l.text }, l.strong && { fontFamily: fonts.bold }]}>{Number(d.slice(8))}</Text>
                {l.dot ? <View style={[styles.tileDot, { backgroundColor: l.dot }, d === today && { borderWidth: 1.5, borderColor: '#FFFFFF' }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ height: 260 }} />
      )}
    </View>
  );
}

function RoundNav({ icon, label, onPress }: { icon: 'chevronLeft' | 'chevronRight'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.nav, webCursor, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'warn' | 'danger' }) {
  return (
    <View style={styles.stat}>
      <Text style={shared.caption}>{label}</Text>
      <Text style={[styles.statValue, tone === 'warn' && { color: '#B97800' }, tone === 'danger' && { color: colors.danger }]}>{value}</Text>
      <Text style={shared.caption}>{detail}</Text>
    </View>
  );
}

/* ───────────── a day ───────────── */

function DaySheet({ wf, st, day, today, onClose }: { wf: WF; st: Staff; day: string | null; today: string; onClose: () => void }) {
  const [last, setLast] = useState(day);
  if (day && day !== last) setLast(day);
  const d = day ?? last;
  const body = (() => {
    if (!d) return null;
    const plan = planFor(wf, st, d);
    const rec = recordFor(wf, st.id, d);
    const a = attendanceOn(wf, st, d, today);
    const roster = rosterFor(st.id);
    const head =
      plan.kind === 'WORK'
        ? `${plan.shift.label} · ${hhmmLabel(plan.shift.start)} – ${hhmmLabel(plan.shift.end)}`
        : plan.kind === 'HOLIDAY'
          ? `Holiday · ${plan.name}`
          : plan.kind === 'LEAVE'
            ? `${LEAVE_TYPES.types.find((t) => t.id === plan.request.type)?.label ?? 'Leave'} · approved`
            : plan.kind === 'OFF'
              ? 'Weekly day off'
              : 'Before you joined';
    const status: Record<NonNullable<DayAttendance>, { label: string; tone: 'ok' | 'warn' | 'danger' | 'navy' | 'chip' }> = {
      PRESENT: { label: 'Worked', tone: 'ok' },
      LATE: { label: 'Late', tone: 'warn' },
      MISSED: { label: 'Missed', tone: 'danger' },
      UPCOMING: { label: 'Upcoming', tone: 'chip' },
      TODAY_PENDING: { label: 'Not checked in', tone: 'warn' },
      ON_SHIFT: { label: 'On shift', tone: 'navy' },
    };
    return (
      <>
        <Text style={shared.kicker}>{niceDay(d, true)}</Text>
        <View style={styles.sheetHead}>
          <Text style={[shared.h1, styles.flex]}>{head}</Text>
          {a ? <Tag label={status[a].label} tone={status[a].tone} /> : null}
        </View>
        {plan.kind === 'WORK' && roster ? <Text style={shared.body}>Report to {roster.reportingPoint}</Text> : null}
        {rec ? (
          <View style={{ marginTop: space.md }}>
            <Line label="Checked in" value={time(rec.checkIn)} />
            <Line label="Checked out" value={rec.checkOut ? time(rec.checkOut) : '—'} />
            <Line label={rec.checkOut ? 'Worked' : 'So far'} value={durationLabel(workedMs(rec))} strong />
            {plan.kind === 'WORK' && isLate(rec, plan.shift) ? (
              <Text style={[shared.caption, { color: '#B97800', marginTop: 2 }]}>
                {Math.round((Date.parse(rec.checkIn) - new Date(`${d}T${plan.shift.start}:00`).getTime()) / 60000)} minutes after the shift start
              </Text>
            ) : null}
            <Text style={[shared.caption, { marginTop: space.sm }]}>{rec.source === 'device' ? 'Recorded on this device.' : 'Demo record.'}</Text>
          </View>
        ) : a === 'MISSED' ? (
          <Notice tone="danger" icon="alert" style={{ marginTop: space.md }}>
            No check-in on this shift. Talk to your supervisor if this is wrong.
          </Notice>
        ) : null}
        {plan.kind === 'LEAVE' ? <Text style={[shared.body, { marginTop: space.sm }]}>“{plan.request.reason}”</Text> : null}
        {plan.kind === 'WORK' && roster?.responsibilities.length ? (
          <View style={{ marginTop: space.lg, gap: 6 }}>
            <Text style={shared.kicker}>On this shift</Text>
            {roster.responsibilities.map((r) => (
              <View key={r} style={styles.bullet}>
                <View style={styles.bulletDot} />
                <Text style={[shared.body, styles.flex]}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  })();
  return (
    <BottomSheet visible={!!day} onClose={onClose}>
      {body}
    </BottomSheet>
  );
}

/* ───────────── leave ───────────── */

function MyRequest({ r, st, first, team }: { r: LeaveRequest; st: Staff; first: boolean; team: Staff[] }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = LEAVE_TYPES.types.find((t) => t.id === r.type);
  const decider = r.decidedBy ? team.find((t) => t.id === r.decidedBy) : undefined;
  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelLeave(st, r.id);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(errText(e, 'Couldn’t withdraw this request.'));
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };
  return (
    <View style={[styles.req, !first && styles.histRule]}>
      <View style={styles.reqTop}>
        <RoundIcon icon={LEAVE_ICON[r.type]} tone="beige" size={36} />
        <View style={styles.flex}>
          <Text style={shared.strong}>
            {type?.label ?? r.type} · {plural(r.days, 'day')}
          </Text>
          <Text style={shared.caption}>{range(r.from, r.to)}</Text>
        </View>
        <Tag label={LEAVE_STATUS[r.status]} tone={LEAVE_TONE[r.status]} />
      </View>
      <Text style={[shared.body, styles.reqReason]} numberOfLines={2}>
        {r.reason}
      </Text>
      {r.status === 'APPROVED' || r.status === 'DECLINED' ? (
        <Text style={[shared.caption, styles.reqReason]}>
          {r.status === 'APPROVED' ? 'Approved' : 'Declined'}
          {decider ? ` by ${displayName(decider.name, false)}` : ''}
          {r.note ? ` · “${r.note}”` : ''}
        </Text>
      ) : null}
      {error ? <Text style={[shared.error, styles.reqReason]}>{error}</Text> : null}
      {r.status === 'PENDING' ? (
        asking ? (
          <View style={[styles.outRow, styles.reqReason]}>
            <Button label="Keep" variant="outline" onPress={() => setAsking(false)} disabled={busy} style={styles.flex} />
            <Button label="Withdraw" variant="dark" onPress={withdraw} loading={busy} style={styles.flex} />
          </View>
        ) : (
          <Pressable onPress={() => setAsking(true)} accessibilityRole="button" style={[styles.reqReason, webCursor]}>
            <Text style={styles.link}>Withdraw request</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function TeamRequest({ r, boss, team }: { r: LeaveRequest; boss: Staff; team: Staff[] }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const who = team.find((t) => t.id === r.staffId);
  const type = LEAVE_TYPES.types.find((t) => t.id === r.type);
  const decide = async (approve: boolean) => {
    if (busy) return;
    setBusy(approve ? 'yes' : 'no');
    setError(null);
    try {
      await decideLeave(boss, team, r.id, approve);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(errText(e, 'Couldn’t save the decision.'));
      setBusy(null);
    }
  };
  return (
    <Panel>
      <View style={styles.reqTop}>
        <RoundIcon icon={LEAVE_ICON[r.type]} tone="orange" size={36} />
        <View style={styles.flex}>
          <Text style={shared.strong}>{who?.name ?? 'Team member'}</Text>
          <Text style={shared.caption}>
            {type?.label ?? r.type} · {plural(r.days, 'day')} · {range(r.from, r.to)}
          </Text>
        </View>
      </View>
      <Text style={[shared.body, { marginTop: space.sm }]}>“{r.reason}”</Text>
      {error ? <Text style={[shared.error, { marginTop: space.sm }]}>{error}</Text> : null}
      <View style={[styles.outRow, { marginTop: space.md }]}>
        <Button label="Decline" variant="outline" onPress={() => decide(false)} loading={busy === 'no'} disabled={!!busy} style={styles.flex} />
        <Button label="Approve" icon="check" onPress={() => decide(true)} loading={busy === 'yes'} disabled={!!busy} style={styles.flex} />
      </View>
    </Panel>
  );
}

function LeaveSheet({ visible, wf, st, today, onClose }: { visible: boolean; wf: WF; st: Staff; today: string; onClose: () => void }) {
  const [type, setType] = useState<LeaveType>('CASUAL');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [month, setMonth] = useState(monthOf(today));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<LeaveRequest | null>(null);

  // each time the sheet opens it starts empty
  const [wasOpen, setWasOpen] = useState(visible);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setFrom(null);
      setTo(null);
      setReason('');
      setError(null);
      setSent(null);
      setMonth(monthOf(today));
    }
  }

  const pick = (d: string) => {
    haptic.tap();
    setError(null);
    if (!from || (from && to) || d < from) {
      setFrom(d);
      setTo(null);
    } else setTo(d);
  };
  const end = to ?? from;
  const days = from && end ? leaveDays(wf, st, from, end) : 0;
  const bal = leaveBalance(wf, st.id).find((b) => b.id === type);
  const picked = from && end ? [from, ...(end !== from ? [end] : [])] : [];
  const inRange = (d: string) => !!from && !!end && d > from && d < end;

  const submit = async () => {
    if (!from || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await requestLeave(st, { type, from, to: end!, reason });
      haptic.success();
      setSent(r);
    } catch (e) {
      haptic.error();
      setError(errText(e, 'Couldn’t send the request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {sent ? (
        <View style={styles.sent}>
          <RoundIcon icon="check" tone="ok" size={56} />
          <Text style={[shared.h1, { textAlign: 'center' }]}>Request sent</Text>
          <Text style={[shared.body, { textAlign: 'center' }]}>
            {plural(sent.days, 'day')} of {LEAVE_TYPES.types.find((t) => t.id === sent.type)?.label.toLowerCase()} · {range(sent.from, sent.to)}. Your supervisor will review it. You can withdraw it while it’s pending.
          </Text>
          <Button label="Done" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: space.md }} />
        </View>
      ) : (
        <>
          <Text style={shared.h1}>Request leave</Text>
          <Text style={[shared.body, { marginTop: 2 }]}>Pick the type and the dates. Only your working days are counted.</Text>
          <View style={styles.types} accessibilityRole="radiogroup">
            {LEAVE_TYPES.types.map((t, i) => (
              <OptionChip key={t.id} label={t.label} icon={LEAVE_ICON[t.id]} selected={type === t.id} delay={i * 40} onPress={() => setType(t.id)} />
            ))}
          </View>
          {bal ? <Text style={shared.caption}>{plural(bal.left, 'day')} left this year.</Text> : null}

          <View style={styles.pickHead}>
            <Text style={[shared.h2, styles.flex]}>{monthName(month)}</Text>
            <RoundNav icon="chevronLeft" label="Previous month" onPress={() => setMonth((m) => (m > monthOf(today) ? addMonth(m, -1) : m))} />
            <RoundNav icon="chevronRight" label="Next month" onPress={() => setMonth((m) => addMonth(m, 1))} />
          </View>
          <View style={styles.pickCal}>
            <MonthGrid
              month={month}
              today={today}
              minDay={today}
              selected={picked}
              onPress={pick}
              look={(d) => {
                const plan = planFor(wf, st, d);
                const sel = picked.includes(d);
                const mid = inRange(d);
                const work = plan.kind === 'WORK';
                return sel
                  ? { bg: colors.ink, border: colors.ink, text: '#FFFFFF', strong: true, label: 'selected' }
                  : mid
                    ? { bg: '#DCE6F3', border: '#DCE6F3', text: colors.ink, label: work ? 'in range, working day' : 'in range, not counted' }
                    : { bg: work ? '#FFFFFF' : 'transparent', border: work ? EDGE : 'transparent', text: work ? colors.ink : colors.inkMuted, label: work ? 'working day' : plan.kind === 'HOLIDAY' ? 'holiday' : plan.kind === 'LEAVE' ? 'already on leave' : 'day off', disabled: plan.kind === 'NONE' };
              }}
            />
          </View>
          <Text style={[shared.strong, { marginTop: space.sm }]}>{from ? `${range(from, end!)} · ${plural(days, 'working day')}` : 'Tap the first day, then the last.'}</Text>

          <View style={{ marginTop: space.md }}>
            <PillTextArea value={reason} onChangeText={setReason} placeholder="Reason (your supervisor sees this)" accessibilityLabel="Reason for leave" />
          </View>
          {error ? (
            <Text style={[shared.error, { marginTop: space.sm }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label="Send request" onPress={submit} loading={busy} disabled={!from || reason.trim().length < 5 || !days} style={{ marginTop: space.lg }} />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flex: 1.5 },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },

  todayTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  times: { flexDirection: 'row', gap: space.sm },
  timeBox: { flex: 1, padding: space.md, borderRadius: 16, backgroundColor: CHIP, gap: 2 },
  timeValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  outRow: { flexDirection: 'row', gap: space.sm },

  calHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  calKicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(10, 28, 62, 0.72)' },
  calMonth: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5, color: '#0A1C3E', marginTop: 1 },
  calYear: { fontFamily: fonts.semibold, color: 'rgba(10, 28, 62, 0.72)' },
  todayBtn: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  todayBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  nav: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255, 255, 255, 0.65)', borderWidth: 1.25, borderColor: 'rgba(255, 255, 255, 0.85)', alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', marginBottom: space.sm },
  weekday: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(10, 28, 62, 0.75)', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 12, padding: 6, borderWidth: 1.25, justifyContent: 'flex-end', alignItems: 'flex-start' },
  tileSel: { borderWidth: 2.5, borderColor: colors.ink },
  tileText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 16 },
  tileDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.semibold, fontSize: 11, color: '#0A1C3E' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexBasis: '47%', flexGrow: 1, padding: space.lg, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: EDGE, gap: 2, ...soft },
  statValue: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  histRule: { borderTopWidth: 1, borderTopColor: '#EFECE6' },
  histDate: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1EDE4', alignItems: 'center', justifyContent: 'center' },
  histDay: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, color: colors.ink },
  histWeek: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.inkMuted },
  more: { paddingVertical: space.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EFECE6' },
  demoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },

  balances: { flexDirection: 'row', gap: space.sm },
  balance: { flex: 1, padding: space.md, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: EDGE, gap: 2, ...soft },
  balanceValue: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  balanceLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },

  req: { paddingVertical: space.md },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reqReason: { marginTop: space.sm, marginLeft: 36 + space.md },

  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2, marginBottom: 2 },
  bullet: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange, marginTop: 7 },

  types: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  pickHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  pickCal: { padding: space.md, borderRadius: 20, backgroundColor: '#F4F2EE' },
  sent: { alignItems: 'center', gap: space.sm, paddingTop: space.md },
});
