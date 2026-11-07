/** The customer app's formatting, so dates and money read the same on both sides, plus a few admin helpers. */
export { money, date, dayDate, time, when, ago, initials, plural, monthLabel } from '@customer/lib/format';

/** 2026-11-05 in the viewer's own time zone. */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A date input's value from an ISO date or timestamp. */
export const toDateInput = (iso: string) => iso.slice(0, 10);

/** +12% / −4% against an earlier figure, or null when there's nothing to compare with. */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Case- and space-insensitive "does this row match what was typed". */
export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w) || hay.replace(/\s+/g, '').includes(w));
}
