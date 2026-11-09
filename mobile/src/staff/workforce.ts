/**
 * Staff workforce records: shifts, attendance, leave, pay, announcements and the employee's own details.
 *
 * MOCK DATA ONLY. Everything here is seeded from src/mock/data/staff-*.json and clearly marked as demo data in the
 * app. Attendance check-ins, leave requests and profile edits made in the app are saved on this device only
 * (AsyncStorage), never sent anywhere. A real HR/attendance backend should replace `workforceStore` and keep the
 * same shapes, so the screens don't change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import announcementsJson from '../mock/data/staff-announcements.json';
import attendanceJson from '../mock/data/staff-attendance.json';
import leaveJson from '../mock/data/staff-leave.json';
import payrollJson from '../mock/data/staff-payroll.json';
import profilesJson from '../mock/data/staff-profiles.json';
import scheduleJson from '../mock/data/staff-schedule.json';
import type { Staff, StaffRole } from '../mock/types';

/* ───────────── shapes ───────────── */

export type Shift = { id: string; label: string; start: string; end: string; breakMinutes: number };
export type Roster = { staffId: string; shiftId: string; weeklyOff: number[]; reportingPoint: string; responsibilities: string[] };
export type Holiday = { date: string; name: string };

export type AttendanceRecord = { id: string; staffId: string; date: string; checkIn: string; checkOut?: string; source: 'seed' | 'device' };

export type LeaveType = 'CASUAL' | 'SICK' | 'EARNED';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
export type LeaveRequest = {
  id: string;
  staffId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
};

export type PayLine = { label: string; amount: number };
export type SalaryStatement = {
  id: string;
  month: string;
  daysInMonth: number;
  daysPayable: number;
  lossOfPayDays: number;
  earnedBase: number;
  incentives: PayLine[];
  deductions: PayLine[];
  gross: number;
  net: number;
  status: 'PAID' | 'PROCESSING';
  paidOn?: string;
  reference: string;
};
export type Payroll = { staffId: string; salary: { monthlyGross: number; components: PayLine[]; effectiveFrom: string }; statements: SalaryStatement[] };

export type EmergencyContact = { name: string; relation: string; phone: string };
export type StaffProfile = {
  staffId: string;
  employeeId: string;
  designation: string;
  department: string;
  employmentType: string;
  email: string;
  reportsTo?: string;
  emergencyContact: EmergencyContact;
};

export type Announcement = { id: string; kind: 'company' | 'branch'; locationIds?: string[]; roles?: StaffRole[]; title: string; body: string; publishedAt: string; pinned: boolean; author: string };
export type Policy = { id: string; title: string; summary: string; body: string };
export type Contact = { id: string; kind: 'support' | 'hr' | 'emergency'; label: string; detail: string; phone: string; email?: string; hours: string };

/** What a staff member wants to hear about. They filter the in-app notification feed and its unread badge. */
export type NotificationPrefs = { newOrders: boolean; deliveries: boolean; issues: boolean; announcements: boolean };
export const DEFAULT_PREFS: NotificationPrefs = { newOrders: true, deliveries: true, issues: true, announcements: true };

/* ───────────── static demo data ───────────── */

export const SCHEDULE = scheduleJson as unknown as {
  attendancePolicy: { lateAfterMinutes: number; checkInOpensMinutesBefore: number; source: string };
  shifts: Shift[];
  rosters: Roster[];
  holidays: Holiday[];
};
export const LEAVE_TYPES = (leaveJson as unknown as { entitlements: { year: number; types: { id: LeaveType; label: string; perYear: number }[] } }).entitlements;
const PAYROLL = payrollJson as unknown as { payDay: string; staff: Payroll[] };
export const PAY_DAY_NOTE = PAYROLL.payDay;
const PROFILES = (profilesJson as unknown as { profiles: StaffProfile[] }).profiles;
const COMPANY = announcementsJson as unknown as { announcements: Announcement[]; policies: Policy[]; contacts: Contact[] };
export const POLICIES = COMPANY.policies;
export const CONTACTS = COMPANY.contacts;

export const rosterFor = (staffId: string) => SCHEDULE.rosters.find((r) => r.staffId === staffId);
export const shiftFor = (staffId: string) => {
  const r = rosterFor(staffId);
  return r ? SCHEDULE.shifts.find((s) => s.id === r.shiftId) : undefined;
};
/** Only the signed-in staff member's own pay record is ever looked up. */
export const payrollFor = (staffId: string) => PAYROLL.staff.find((p) => p.staffId === staffId);
export const profileFor = (staffId: string) => PROFILES.find((p) => p.staffId === staffId);

export function announcementsFor(st: Staff): Announcement[] {
  return COMPANY.announcements
    .filter((a) => (!a.locationIds || a.locationIds.includes(st.locationId)) && (!a.roles || a.roles.includes(st.role)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/* ───────────── dates ───────────── */

/** Local calendar day "2026-11-08". */
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atLocal = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`).getTime();
const weekday = (day: string) => new Date(`${day}T12:00:00`).getDay();
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`).getTime();
  while (d.getTime() <= end && out.length < 400) {
    out.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export const hhmmLabel = (hhmm: string) => {
  const h = Number(hhmm.slice(0, 2));
  return `${h % 12 || 12}:${hhmm.slice(3)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const durationLabel = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

/* ───────────── the device-saved part ───────────── */

type State = {
  version: 1;
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  edits: Record<string, { email?: string; emergencyContact?: EmergencyContact }>;
  prefs: Record<string, NotificationPrefs>;
  counter: number;
};

const KEY = 'wb.staff-workforce.v1';
const seed = (): State => ({
  version: 1,
  attendance: JSON.parse(JSON.stringify((attendanceJson as unknown as { records: AttendanceRecord[] }).records)),
  leave: JSON.parse(JSON.stringify((leaveJson as unknown as { requests: LeaveRequest[] }).requests)),
  edits: {},
  prefs: {},
  counter: 2000,
});

let state: State | null = null;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load() {
  if (!loading) {
    loading = AsyncStorage.getItem(KEY)
      .then((raw) => {
        const parsed = raw ? (JSON.parse(raw) as State) : null;
        state = parsed?.version === 1 ? parsed : seed();
      })
      .catch(() => {
        state = seed();
      })
      .finally(() => listeners.forEach((l) => l()));
  }
  return loading;
}

async function commit(next: State) {
  state = next;
  listeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the change still holds for this session
  }
}

/** Runs one change at a time on a copy; a rule that says no throws and nothing changes. Mock latency included. */
let queue: Promise<unknown> = Promise.resolve();
function change<T>(fn: (s: State) => T, latency = 500): Promise<T> {
  const run = queue.then(async () => {
    await load();
    await wait(latency);
    const copy: State = JSON.parse(JSON.stringify(state));
    const out = fn(copy);
    await commit(copy);
    return out;
  });
  queue = run.catch(() => {});
  return run;
}

export const workforceStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    void load();
    return () => listeners.delete(l);
  },
  get: () => state,
  async reset() {
    await load();
    await commit(seed());
  },
};

export function useWorkforce(): State | null {
  return useSyncExternalStore(workforceStore.subscribe, workforceStore.get, workforceStore.get);
}

/* ───────────── a day in someone's schedule ───────────── */

export type DayPlan =
  | { kind: 'WORK'; shift: Shift }
  | { kind: 'OFF' }
  | { kind: 'HOLIDAY'; name: string }
  | { kind: 'LEAVE'; request: LeaveRequest }
  | { kind: 'NONE' };

export function planFor(s: State, st: Staff, day: string): DayPlan {
  const roster = rosterFor(st.id);
  const shift = shiftFor(st.id);
  if (!roster || !shift || day < st.joinedAt.slice(0, 10)) return { kind: 'NONE' };
  const holiday = SCHEDULE.holidays.find((h) => h.date === day);
  if (holiday) return { kind: 'HOLIDAY', name: holiday.name };
  const leave = s.leave.find((r) => r.staffId === st.id && r.status === 'APPROVED' && r.from <= day && day <= r.to);
  if (leave) return { kind: 'LEAVE', request: leave };
  if (roster.weeklyOff.includes(weekday(day))) return { kind: 'OFF' };
  return { kind: 'WORK', shift };
}

export type DayAttendance = 'PRESENT' | 'LATE' | 'MISSED' | 'UPCOMING' | 'TODAY_PENDING' | 'ON_SHIFT' | null;

export const recordFor = (s: State, staffId: string, day: string) => s.attendance.find((a) => a.staffId === staffId && a.date === day);

export function isLate(rec: AttendanceRecord, shift: Shift) {
  return Date.parse(rec.checkIn) > atLocal(rec.date, shift.start) + SCHEDULE.attendancePolicy.lateAfterMinutes * 60_000;
}

export function attendanceOn(s: State, st: Staff, day: string, today = dayKey()): DayAttendance {
  const plan = planFor(s, st, day);
  const rec = recordFor(s, st.id, day);
  if (plan.kind !== 'WORK') return rec ? 'PRESENT' : null;
  if (day > today) return 'UPCOMING';
  if (!rec) return day === today ? 'TODAY_PENDING' : 'MISSED';
  if (day === today && !rec.checkOut) return 'ON_SHIFT';
  return isLate(rec, plan.shift) ? 'LATE' : 'PRESENT';
}

export const workedMs = (r: AttendanceRecord, now = Date.now()) => (r.checkOut ? Date.parse(r.checkOut) : now) - Date.parse(r.checkIn);

/** Days worked, hours and lates/misses for a month ("2026-11"), up to today. */
export function monthSummary(s: State, st: Staff, month: string, today = dayKey()) {
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const days = daysBetween(`${month}-01`, `${month}-${String(last).padStart(2, '0')}`).filter((d) => d <= today);
  let worked = 0;
  let late = 0;
  let missed = 0;
  let ms = 0;
  let scheduled = 0;
  for (const d of days) {
    const a = attendanceOn(s, st, d, today);
    if (planFor(s, st, d).kind === 'WORK') scheduled += 1;
    if (a === 'PRESENT' || a === 'LATE' || a === 'ON_SHIFT') {
      worked += 1;
      const r = recordFor(s, st.id, d);
      if (r && r.checkOut) ms += workedMs(r);
    }
    if (a === 'LATE') late += 1;
    if (a === 'MISSED') missed += 1;
  }
  return { worked, late, missed, scheduled, hours: ms };
}

/* ───────────── attendance actions ───────────── */

export class WorkforceError extends Error {}
const no = (message: string): never => {
  throw new WorkforceError(message);
};

export function checkInState(s: State, st: Staff, now = new Date()) {
  const day = dayKey(now);
  const plan = planFor(s, st, day);
  const rec = recordFor(s, st.id, day);
  if (plan.kind !== 'WORK') return { can: false as const, rec, plan, reason: plan.kind === 'HOLIDAY' ? `Holiday · ${plan.name}` : plan.kind === 'LEAVE' ? 'You’re on approved leave today' : 'No shift today' };
  const opens = atLocal(day, plan.shift.start) - SCHEDULE.attendancePolicy.checkInOpensMinutesBefore * 60_000;
  if (!rec && now.getTime() < opens) return { can: false as const, rec, plan, reason: `Check-in opens at ${new Date(opens).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` };
  return { can: true as const, rec, plan, reason: '' };
}

export function checkIn(st: Staff) {
  return change((s) => {
    const now = new Date();
    const c = checkInState(s, st, now);
    if (!c.can) no(c.reason);
    if (c.rec) no('You’ve already checked in today.');
    s.counter += 1;
    const rec: AttendanceRecord = { id: `att-${s.counter}`, staffId: st.id, date: dayKey(now), checkIn: now.toISOString(), source: 'device' };
    s.attendance.push(rec);
    return rec;
  });
}

export function checkOut(st: Staff) {
  return change((s) => {
    const rec = recordFor(s, st.id, dayKey());
    if (!rec) return no('Check in first.');
    if (rec.checkOut) no('You’ve already checked out today.');
    rec.checkOut = new Date().toISOString();
    return rec;
  });
}

/* ───────────── leave ───────────── */

/** Working days a request would take off (weekly offs and holidays don't count). */
export function leaveDays(s: State, st: Staff, from: string, to: string) {
  return daysBetween(from, to).filter((d) => planFor({ ...s, leave: [] }, st, d).kind === 'WORK').length;
}

export function leaveBalance(s: State, staffId: string) {
  const year = String(LEAVE_TYPES.year);
  return LEAVE_TYPES.types.map((t) => {
    const mine = s.leave.filter((r) => r.staffId === staffId && r.type === t.id && r.from.startsWith(year));
    const used = mine.filter((r) => r.status === 'APPROVED').reduce((n, r) => n + r.days, 0);
    const pending = mine.filter((r) => r.status === 'PENDING').reduce((n, r) => n + r.days, 0);
    return { ...t, used, pending, left: Math.max(0, t.perYear - used - pending) };
  });
}

export function requestLeave(st: Staff, input: { type: LeaveType; from: string; to: string; reason: string }) {
  return change((s) => {
    const today = dayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to)) no('Choose the dates.');
    if (input.from < today) no('Leave can’t start in the past.');
    if (input.to < input.from) no('The last day must be on or after the first day.');
    if (input.reason.trim().length < 5) no('Give a short reason (at least 5 characters).');
    const days = leaveDays(s, st, input.from, input.to);
    if (!days) no('Those dates have no shifts to take off.');
    const clash = s.leave.find((r) => r.staffId === st.id && (r.status === 'PENDING' || r.status === 'APPROVED') && r.from <= input.to && input.from <= r.to);
    if (clash) no(`You already have ${clash.status === 'PENDING' ? 'a pending' : 'approved'} leave on those dates.`);
    const bal = leaveBalance(s, st.id).find((b) => b.id === input.type)!;
    if (days > bal.left) no(`Only ${bal.left} ${bal.label.toLowerCase()} day${bal.left === 1 ? '' : 's'} left.`);
    s.counter += 1;
    const req: LeaveRequest = { id: `lv-${s.counter}`, staffId: st.id, type: input.type, from: input.from, to: input.to, days, reason: input.reason.trim(), status: 'PENDING', requestedAt: new Date().toISOString() };
    s.leave.unshift(req);
    return req;
  }, 700);
}

export function cancelLeave(st: Staff, id: string) {
  return change((s) => {
    const r = s.leave.find((x) => x.id === id);
    if (!r || r.staffId !== st.id) return no('Request not found.');
    if (r.status !== 'PENDING') no('Only a pending request can be withdrawn.');
    r.status = 'CANCELLED';
    r.decidedAt = new Date().toISOString();
  });
}

/** A supervisor approves or declines a request from someone at their own branch (never their own). */
export function decideLeave(boss: Staff, team: Staff[], id: string, approve: boolean, note?: string) {
  return change((s) => {
    if (!boss.permissions.includes('ORDER_ASSIGN')) no('Only a branch supervisor can decide leave.');
    const r = s.leave.find((x) => x.id === id);
    if (!r) return no('Request not found.');
    const who = team.find((t) => t.id === r.staffId);
    if (!who || who.locationId !== boss.locationId) no('That person isn’t at your branch.');
    if (r.staffId === boss.id) no('Your own leave is approved by the admin team.');
    if (r.status !== 'PENDING') no('This request was already decided.');
    r.status = approve ? 'APPROVED' : 'DECLINED';
    r.decidedBy = boss.id;
    r.decidedAt = new Date().toISOString();
    if (note?.trim()) r.note = note.trim();
  }, 600);
}

/* ───────────── profile and preferences ───────────── */

export function profileWithEdits(s: State | null, staffId: string): StaffProfile | undefined {
  const base = profileFor(staffId);
  if (!base) return undefined;
  const e = s?.edits[staffId];
  return e ? { ...base, email: e.email ?? base.email, emergencyContact: e.emergencyContact ?? base.emergencyContact } : base;
}

/** Staff can change only their personal email and emergency contact; everything else comes from HR. */
export function saveProfile(staffId: string, input: { email: string; emergencyContact: EmergencyContact }) {
  return change((s) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) no('Enter a valid email address.');
    if (input.emergencyContact.name.trim().length < 2) no('Enter the emergency contact’s name.');
    if (input.emergencyContact.phone.replace(/\D/g, '').length < 10) no('Enter a 10-digit phone number for the emergency contact.');
    s.edits[staffId] = { email: input.email.trim(), emergencyContact: { name: input.emergencyContact.name.trim(), relation: input.emergencyContact.relation.trim(), phone: input.emergencyContact.phone.trim() } };
  }, 600);
}

export const prefsFor = (s: State | null, staffId: string) => ({ ...DEFAULT_PREFS, ...(s?.prefs[staffId] ?? {}) });

export function savePrefs(staffId: string, prefs: NotificationPrefs) {
  return change((s) => {
    s.prefs[staffId] = prefs;
  }, 150);
}
