import { ORDER_STAGES, type Order, type OrderStatus } from '../../types/models';
import { db, newest, respond } from './db';

export type OrderFilter = 'all' | 'active' | 'completed' | 'cancelled';

export const isActive = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';

export function filterOrders(orders: Order[], filter: OrderFilter): Order[] {
  switch (filter) {
    case 'active':
      return orders.filter((o) => isActive(o.status));
    case 'completed':
      return orders.filter((o) => o.status === 'delivered');
    case 'cancelled':
      return orders.filter((o) => o.status === 'cancelled');
    default:
      return orders;
  }
}

const newestFirst = (a: Order, b: Order) => newest(a.placedAt, b.placedAt);

export function listOrders(): Promise<Order[]> {
  return respond([...db.orders].sort(newestFirst));
}

export function getOrder(id: string): Promise<Order | null> {
  return respond(db.orders.find((o) => o.id === id) ?? null);
}

/** 0-based position in the 5-step journey (0..4), or -1 for cancelled orders. */
export function stageIndex(status: OrderStatus): number {
  switch (status) {
    case 'pickup_scheduled':
    case 'collected':
      return 0; // Step 1: Drop-off & Collection
    case 'washing':
    case 'drying':
    case 'washing_drying':
      return 1; // Step 2: Washing & Drying
    case 'ironing':
    case 'packing':
    case 'ironing_packing':
      return 2; // Step 3: Ironing & Packing
    case 'out_for_delivery':
      return 3; // Step 4: Out for Delivery
    case 'delivered':
      return 4; // Step 5: Delivered
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}
