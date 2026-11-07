import type { PickupRequest } from '../../types/models';
import { db, newest, respond } from './db';

export function listRequests(): Promise<PickupRequest[]> {
  return respond([...db.requests].sort((a, b) => newest(a.createdAt, b.createdAt)));
}

/** Only requests that haven't been collected yet can be cancelled. */
export const canCancel = (r: PickupRequest) => r.status === 'pending' || r.status === 'confirmed';

/** SIMULATED: updates the in-memory mock only. */
export function cancelRequest(id: string): Promise<PickupRequest | null> {
  const r = db.requests.find((x) => x.id === id);
  if (!r || !canCancel(r)) return respond(null);
  r.status = 'cancelled';
  r.cancelReason = 'Cancelled by you before pickup.';
  if (r.orderId) {
    const order = db.orders.find((o) => o.id === r.orderId);
    if (order) {
      order.status = 'cancelled';
      order.cancelReason = r.cancelReason;
      order.payment.status = 'not_charged';
    }
  }
  return respond(r);
}
