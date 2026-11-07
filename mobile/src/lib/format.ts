/** Display formatting shared by every screen. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,250 */
export function money(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}

const parse = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
const hasTime = (iso: string) => iso.length > 10;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 6:40 PM */
export function time(iso: string): string {
  const d = parse(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** When something happened, the way people say it: Today · 6:40 PM, Yesterday · 9:05 AM, Mon, 26 Oct · 11:05 AM */
export function when(iso: string, now = new Date()): string {
  const d = parse(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.getFullYear() === now.getFullYear() ? dayDate(iso) : date(iso);
  return hasTime(iso) ? `${day} · ${time(iso)}` : day;
}

/** November, or November 2025 outside the current year: for grouping lists by month */
export function monthLabel(iso: string, now = new Date()): string {
  const d = parse(iso);
  return d.getFullYear() === now.getFullYear() ? FULL_MONTHS[d.getMonth()] : `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 4 Nov 2026 */
export function date(iso: string): string {
  const d = parse(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Wed, 4 Nov */
export function dayDate(iso: string): string {
  const d = parse(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** { weekday: 'Wed', day: '4', month: 'Nov' } for date chips */
export function dateParts(iso: string) {
  const d = parse(iso);
  return { weekday: DAYS[d.getDay()], day: String(d.getDate()), month: MONTHS[d.getMonth()] };
}

/** 2h ago · Yesterday · 26 Oct */
export function ago(iso: string, now = new Date()): string {
  const d = parse(iso);
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
