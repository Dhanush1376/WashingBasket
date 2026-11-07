import type { PickupRequest, PickupSlot, ServiceId } from '../../types/models';
import { db, nextId, respond } from './db';

export type SlotDay = { date: string; slots: (PickupSlot & { available: boolean })[] };

const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Bookable days start tomorrow; availability follows pickup-slots.json. */
export function getPickupDays(): Promise<SlotDay[]> {
  const { daysAhead, slots, fullyBooked } = db.pickupSlots;
  const days: SlotDay[] = [];
  for (let offset = 0; offset < daysAhead; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + 1 + offset);
    days.push({
      date: isoDay(d),
      slots: slots.map((s) => ({
        ...s,
        available: !fullyBooked.some((f) => f.dayOffset === offset && f.slotId === s.id),
      })),
    });
  }
  return respond(days);
}

export function slotById(id: string): PickupSlot | undefined {
  return db.pickupSlots.slots.find((s) => s.id === id);
}

export type BookingInput = {
  serviceId: ServiceId;
  pickupDate: string;
  slotId: string;
  addressId: string;
  notes?: string;
};

/**
 * SIMULATED: records the pickup request in the in-memory mock database only. Nothing is sent to
 * a server; a real implementation would POST the booking and return the created request.
 */
export async function createBooking(input: BookingInput): Promise<PickupRequest> {
  const request: PickupRequest = {
    id: nextId(db.requests.map((r) => r.id), 'RQ'),
    createdAt: new Date().toISOString(),
    status: 'pending',
    ...input,
    notes: input.notes?.trim() || undefined,
  };
  db.requests.unshift(request);
  const slot = slotById(input.slotId);
  db.notifications.unshift({
    id: nextId(db.notifications.map((n) => n.id), 'n-'),
    type: 'pickup',
    title: 'Pickup requested',
    body: `Request ${request.id} is waiting for confirmation${slot ? ` · ${slot.label}` : ''}.`,
    createdAt: request.createdAt,
    read: false,
    requestId: request.id,
  });
  return respond(request, 600);
}
