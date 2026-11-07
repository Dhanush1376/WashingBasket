/** Pickup time slots and the PIN codes we collect from. */
import type { AdminPickupSlot, AdminPickupSlots, PickupSlot, ServiceArea } from '@/types';
import { db, nextId, respond } from './db';

export type SlotUsage = Record<string, number>;

export function getPickupSlots(): Promise<AdminPickupSlots & { usage: SlotUsage }> {
  // how many pickups are booked into each slot from today on, to warn before a slot is removed
  const today = new Date().toISOString().slice(0, 10);
  const usage: SlotUsage = {};
  db.requests
    .filter((r) => (r.status === 'pending' || r.status === 'confirmed') && r.pickupDate >= today)
    .forEach((r) => (usage[r.slotId] = (usage[r.slotId] ?? 0) + 1));
  return respond({ ...db.pickupSlots, usage }, 'slots');
}

export type SlotInput = Pick<PickupSlot, 'label' | 'period'>;

/** SIMULATED */
export function addSlot(input: SlotInput): Promise<AdminPickupSlot> {
  const slot: AdminPickupSlot = { id: nextId(db.pickupSlots.slots.map((s) => s.id), 's-'), label: input.label.trim(), period: input.period, enabled: true };
  db.pickupSlots.slots.push(slot);
  return respond(slot, '', 400);
}

/** SIMULATED */
export function updateSlot(id: string, patch: Partial<SlotInput & { enabled: boolean }>): Promise<AdminPickupSlot> {
  const s = db.pickupSlots.slots.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('Slot not found'));
  Object.assign(s, patch);
  return respond(s, '', 350);
}

/** SIMULATED */
export function deleteSlot(id: string): Promise<void> {
  db.pickupSlots.slots = db.pickupSlots.slots.filter((s) => s.id !== id);
  db.pickupSlots.fullyBooked = db.pickupSlots.fullyBooked.filter((f) => f.slotId !== id);
  return respond(undefined, '', 350);
}

/** SIMULATED: how many days ahead customers can book. */
export function setDaysAhead(days: number): Promise<AdminPickupSlots> {
  db.pickupSlots.daysAhead = days;
  db.pickupSlots.fullyBooked = db.pickupSlots.fullyBooked.filter((f) => f.dayOffset < days);
  return respond(db.pickupSlots, '', 300);
}

/** SIMULATED: marks a slot on a day as full (customers can't pick it) or opens it again. */
export function toggleFull(dayOffset: number, slotId: string): Promise<AdminPickupSlots> {
  const list = db.pickupSlots.fullyBooked;
  const i = list.findIndex((f) => f.dayOffset === dayOffset && f.slotId === slotId);
  if (i >= 0) list.splice(i, 1);
  else list.push({ dayOffset, slotId });
  return respond(db.pickupSlots, '', 200);
}

export type AreaRow = ServiceArea & { customers: number };

export function listServiceAreas(): Promise<AreaRow[]> {
  return respond(
    db.serviceAreas.map((a) => ({ ...a, customers: new Set(db.addresses.filter((x) => x.pincode === a.pincode).map((x) => x.customerId)).size })),
    'slots',
  );
}

export const areaExists = (pincode: string, except?: string) => db.serviceAreas.some((a) => a.pincode === pincode && a.pincode !== except);

/** SIMULATED */
export function saveServiceArea(input: ServiceArea, originalPincode?: string): Promise<ServiceArea> {
  const existing = originalPincode ? db.serviceAreas.find((a) => a.pincode === originalPincode) : undefined;
  const clean = { ...input, area: input.area.trim(), city: input.city.trim(), note: input.note.trim() };
  if (existing) Object.assign(existing, clean);
  else db.serviceAreas.push(clean);
  return respond(clean, '', 400);
}

/** SIMULATED */
export function deleteServiceArea(pincode: string): Promise<void> {
  db.serviceAreas = db.serviceAreas.filter((a) => a.pincode !== pincode);
  return respond(undefined, '', 300);
}
