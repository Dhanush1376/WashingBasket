/** Small helpers shared by the engine. Plain TypeScript, no platform code. */
import type { Actor, Counters, MockState, OpContext, PickupSlotDef } from '../types.ts';

/** A business rule said no. `code` is stable for tests and UI; `message` is written for people. */
export class MockError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'MockError';
  }
}

export const fail = (code: string, message: string): never => {
  throw new MockError(code, message);
};

export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Next number from a named counter, e.g. order → 1011. */
export function nextNumber(s: MockState, counter: keyof Counters): number {
  s.counters[counter] += 1;
  return s.counters[counter];
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out at a counter

/** A random token. Uses the platform's crypto source when there is one. MOCK ONLY: not a security mechanism. */
export function randomToken(length = 10): string {
  const bytes = new Uint8Array(length);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export const isPast = (iso: string | undefined, now: string) => !!iso && Date.parse(iso) <= Date.parse(now);
export const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** Indian mobile numbers: the last 10 digits are what people type. */
/** "2026-11-05" for a date in this device's time zone. */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** True when `day` is today and the pickup slot has already started, so it can no longer be booked. */
export const slotStarted = (slot: PickupSlotDef, day: string, now: string | Date = new Date()) => {
  const n = typeof now === 'string' ? new Date(now) : now;
  return day === localDay(n) && n.getHours() >= slot.startHour;
};

export const phoneDigits = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export function formatPhone(phone: string) {
  const d = phoneDigits(phone);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone;
}

export const SYSTEM: Actor = { kind: 'system', id: 'system', name: 'Washing Basket' };

export const ctxNow = (): OpContext => ({ now: new Date().toISOString() });

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const rupees = (n: number) => `₹${inr.format(Math.round(n))}`;
