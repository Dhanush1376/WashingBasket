import type { AdminRequest } from '@/types';
import { db, newest, respond } from './db';
import { addressLine, customerName, serviceName, slotLabel } from './lookups';
import { createOrderFromRequest } from './orders.service';

export type RequestRow = AdminRequest & {
  customerName: string;
  serviceName: string;
  slotLabel: string;
  addressLine: string;
};

const toRow = (r: AdminRequest): RequestRow => ({
  ...r,
  customerName: customerName(r.customerId),
  serviceName: serviceName(r.serviceId),
  slotLabel: slotLabel(r.slotId),
  addressLine: addressLine(r.addressId),
});

export function listRequests(): Promise<RequestRow[]> {
  return respond([...db.requests].sort((a, b) => newest(a.createdAt, b.createdAt)).map(toRow), 'requests');
}

function find(id: string) {
  const r = db.requests.find((x) => x.id === id);
  if (!r) throw new Error('Pickup request not found');
  return r;
}

/** SIMULATED: confirms the slot in the sample data. */
export async function confirmRequest(id: string): Promise<RequestRow> {
  const r = find(id);
  r.status = 'confirmed';
  return respond(toRow(r), '', 400);
}

/** SIMULATED: marks the clothes as collected and opens an order for them (items are counted at the store). */
export async function markPickedUp(id: string): Promise<RequestRow> {
  const r = find(id);
  r.status = 'picked_up';
  if (!r.orderId) r.orderId = createOrderFromRequest(r).id;
  else {
    const o = db.orders.find((x) => x.id === r.orderId);
    if (o && o.status === 'pickup_scheduled') o.status = 'collected';
  }
  return respond(toRow(r), '', 450);
}

/** SIMULATED: cancels the pickup (and its order, if one was opened) in the sample data. */
export async function cancelRequest(id: string, reason: string): Promise<RequestRow> {
  const r = find(id);
  r.status = 'cancelled';
  r.cancelReason = reason;
  const o = r.orderId ? db.orders.find((x) => x.id === r.orderId) : undefined;
  if (o && o.status === 'pickup_scheduled') {
    o.status = 'cancelled';
    o.cancelReason = reason;
    if (o.payment.status === 'pending') o.payment.status = 'not_charged';
  }
  return respond(toRow(r), '', 400);
}
