/**
 * Generates the staff app's DEMO workforce records — attendance history and salary statements — from the hand-written
 * rosters, leave and pay structures, so every record agrees with the schedule it came from.
 *
 *   node --experimental-strip-types scripts/staff/generate-workforce.ts
 *
 * Reads:  src/mock/data/staff.json, staff-schedule.json, staff-leave.json, staff-payroll-structure.json
 * Writes: src/mock/data/staff-attendance.json, staff-payroll.json
 *
 * MOCK DATA ONLY. These are illustrative records for demonstrating the staff app, not real attendance or pay.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '../../src/mock/data');
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const write = (f: string, v: unknown) => writeFileSync(join(DATA, f), `${JSON.stringify(v, null, 2)}\n`);

type Shift = { id: string; start: string; end: string };
type Roster = { staffId: string; shiftId: string; weeklyOff: number[] };
type Leave = { staffId: string; from: string; to: string; status: string };

const staff: { id: string; role: string; status: string; joinedAt: string }[] = read('staff.json').staff;
const schedule: { shifts: Shift[]; rosters: Roster[]; holidays: { date: string }[] } = read('staff-schedule.json');
const leave: { requests: Leave[] } = read('staff-leave.json');
const structure: { byRole: Record<string, { gross: number; components: { label: string; share: number }[]; incentives: Record<string, { label: string; amount: number }[]> }>; esiCeiling: number } =
  read('staff-payroll-structure.json');

/** Attendance is generated up to the day before the demo "today". */
const FROM = '2026-10-01';
const UNTIL = '2026-11-07';

const holidays = new Set(schedule.holidays.map((h) => h.date));
const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const onLeave = (staffId: string, d: string) => leave.requests.some((r) => r.staffId === staffId && r.status === 'APPROVED' && r.from <= d && d <= r.to);
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Small deterministic PRNG so the generated history is the same every run. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const attendance: { id: string; staffId: string; date: string; checkIn: string; checkOut: string; source: 'seed' }[] = [];
const missed: Record<string, Record<string, number>> = {};

for (const r of schedule.rosters) {
  const st = staff.find((s) => s.id === r.staffId);
  if (!st || st.status !== 'ACTIVE') continue;
  const shift = schedule.shifts.find((s) => s.id === r.shiftId)!;
  const rand = rng(r.staffId);
  for (const d of days(FROM, UNTIL)) {
    if (d < st.joinedAt.slice(0, 10) || r.weeklyOff.includes(weekday(d)) || holidays.has(d) || onLeave(r.staffId, d)) continue;
    const roll = rand();
    if (roll < 0.035) {
      (missed[r.staffId] ??= {})[d.slice(0, 7)] = (missed[r.staffId]?.[d.slice(0, 7)] ?? 0) + 1;
      continue; // absent without leave: no record, shown as "Missed"
    }
    const late = roll > 0.92;
    const inMin = toMin(shift.start) + (late ? 14 + Math.floor(rand() * 22) : -12 + Math.floor(rand() * 18));
    const outMin = toMin(shift.end) + Math.floor(rand() * 28) - 4;
    attendance.push({ id: `att-${r.staffId}-${d}`, staffId: r.staffId, date: d, checkIn: `${d}T${hhmm(inMin)}:00+05:30`, checkOut: `${d}T${hhmm(outMin)}:00+05:30`, source: 'seed' });
  }
}

/* ───────────── salary statements: Aug, Sep, Oct 2026 (paid on the 1st of the next month) ───────────── */

const MONTHS = ['2026-08', '2026-09', '2026-10'];
const monthDays = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
const nextMonthFirst = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
};
const round = (n: number) => Math.round(n);

const payroll = staff
  .filter((s) => s.status === 'ACTIVE')
  .map((s) => {
    const pay = structure.byRole[s.role];
    const components = pay.components.map((c) => ({ label: c.label, amount: round(pay.gross * c.share) }));
    const basic = components[0].amount;
    const joined = s.joinedAt.slice(0, 10);
    const statements = MONTHS.filter((m) => `${m}-${String(monthDays(m)).padStart(2, '0')}` >= joined).map((m) => {
      const total = monthDays(m);
      const startDay = joined.slice(0, 7) === m ? Number(joined.slice(8)) : 1;
      const lop = missed[s.id]?.[m] ?? 0;
      const payable = total - (startDay - 1) - lop;
      const earned = round((pay.gross * payable) / total);
      const incentives = pay.incentives[m] ?? [];
      const deductions = [{ label: 'Provident fund (12% of basic)', amount: round(((basic * payable) / total) * 0.12) }];
      if (pay.gross <= structure.esiCeiling) deductions.push({ label: 'ESI (0.75%)', amount: round(earned * 0.0075) });
      const gross = earned + incentives.reduce((n, i) => n + i.amount, 0);
      const net = gross - deductions.reduce((n, d) => n + d.amount, 0);
      const ref = `SAL-${m.replace('-', '').slice(2)}-${s.id.replace('st-', '').replace('-', '').toUpperCase()}`;
      return {
        id: `pay-${s.id}-${m}`,
        month: m,
        daysInMonth: total,
        daysPayable: payable,
        lossOfPayDays: lop,
        earnedBase: earned,
        incentives,
        deductions,
        gross,
        net,
        status: 'PAID',
        paidOn: nextMonthFirst(m),
        reference: ref,
      };
    });
    return { staffId: s.id, salary: { monthlyGross: pay.gross, components, effectiveFrom: joined }, statements: statements.reverse() };
  });

write('staff-attendance.json', { _note: 'DEMO DATA generated by scripts/staff/generate-workforce.ts. Not real attendance.', from: FROM, until: UNTIL, records: attendance });
write('staff-payroll.json', {
  _note: 'DEMO DATA generated by scripts/staff/generate-workforce.ts. Illustrative salary figures, not real pay.',
  currency: 'INR',
  payDay: 'Salaries are paid on the 1st of the following month.',
  staff: payroll,
});
console.log(`attendance: ${attendance.length} records · payroll: ${payroll.length} staff`);
