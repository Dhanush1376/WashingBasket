import { ORDER_STAGES, type AdminOrder, type AdminRequest, type Customer, type CustomerAddress, type OrderStatus, type OrderTotals } from '@/types';
import { db, newest, nextId, nowIso, respond } from './db';
import { customerName, itemsLabel, orderTotals, serviceName, slotLabel } from './lookups';

type OrderItem = AdminOrder['items'][number];
export type { OrderItem };

export type OrderRow = AdminOrder & {
  customerName: string;
  serviceName: string;
  total: number;
  itemsLabel: string;
  slotLabel: string;
};

export function toOrderRow(o: AdminOrder): OrderRow {
  return {
    ...o,
    customerName: customerName(o.customerId),
    serviceName: serviceName(o.serviceId),
    total: orderTotals(o).total,
    itemsLabel: itemsLabel(o),
    slotLabel: slotLabel(o.pickup.slotId),
  };
}

export function listOrders(): Promise<OrderRow[]> {
  return respond([...db.orders].sort((a, b) => newest(a.placedAt, b.placedAt)).map(toOrderRow), 'orders');
}

export type OrderDetail = {
  order: OrderRow;
  customer: Customer | null;
  address: CustomerAddress | null;
  totals: OrderTotals;
  request: AdminRequest | null;
};

export function getOrder(id: string): Promise<OrderDetail | null> {
  const o = db.orders.find((x) => x.id === id);
  if (!o) return respond(null, 'orders');
  return respond(
    {
      order: toOrderRow(o),
      customer: db.customers.find((c) => c.id === o.customerId) ?? null,
      address: db.addresses.find((a) => a.id === o.pickup.addressId) ?? null,
      totals: orderTotals(o),
      request: db.requests.find((r) => r.id === o.requestId) ?? null,
    },
    'orders',
  );
}

function find(id: string) {
  const o = db.orders.find((x) => x.id === id);
  if (!o) throw new Error('Order not found');
  return o;
}

/** The next step of the garment journey, or null when the order is finished. */
export function nextStage(status: OrderStatus): OrderStatus | null {
  if (status === 'cancelled' || status === 'delivered') return null;
  const idx = (ORDER_STAGES as readonly string[]).indexOf(status);
  return idx >= 0 && idx < ORDER_STAGES.length - 1 ? ORDER_STAGES[idx + 1] : null;
}

/** SIMULATED: moves the order to a step of the journey in the in-memory sample data. */
export async function setOrderStatus(id: string, status: Exclude<OrderStatus, 'cancelled'>): Promise<OrderRow> {
  const o = find(id);
  o.status = status;
  if (status === 'delivered') {
    o.deliveredAt = nowIso();
    if (o.payment.method === 'Pay on delivery') o.payment.status = 'paid';
  } else {
    delete o.deliveredAt;
  }
  const req = db.requests.find((r) => r.id === o.requestId);
  if (req && status !== 'pickup_scheduled' && req.status !== 'picked_up') req.status = 'picked_up';
  return respond(toOrderRow(o), '', 400);
}

/** SIMULATED: cancels in the sample data. Nothing is refunded because no payment system is connected. */
export async function cancelOrder(id: string, reason: string): Promise<OrderRow> {
  const o = find(id);
  o.status = 'cancelled';
  o.cancelReason = reason;
  if (o.payment.status === 'pending') o.payment.status = 'not_charged';
  return respond(toOrderRow(o), '', 400);
}

/** SIMULATED: records that the customer paid on delivery. No money is collected by the portal. */
export async function markOrderPaid(id: string): Promise<OrderRow> {
  const o = find(id);
  o.payment.status = 'paid';
  return respond(toOrderRow(o), '', 350);
}

/** SIMULATED: the items counted at the store, priced from the price list. */
export async function updateOrderItems(id: string, items: OrderItem[]): Promise<OrderRow> {
  const o = find(id);
  o.items = items.filter((i) => i.qty > 0);
  return respond(toOrderRow(o), '', 450);
}

/** SIMULATED: turns a collected pickup into an order (used by Pickup requests). */
export function createOrderFromRequest(req: AdminRequest): AdminOrder {
  const service = db.services.find((s) => s.id === req.serviceId);
  const days = service ? parseInt(service.turnaround, 10) || 2 : 2;
  const hours = service?.turnaround.includes('hour') ? days : days * 24;
  const est = new Date(Date.now() + hours * 3600_000).toISOString().slice(0, 10);
  const order: AdminOrder = {
    id: nextId(db.orders.map((x) => x.id), 'WB'),
    customerId: req.customerId,
    serviceId: req.serviceId,
    status: 'collected',
    placedAt: req.createdAt,
    pickup: { date: req.pickupDate, slotId: req.slotId, addressId: req.addressId },
    estimatedDelivery: est,
    items: [],
    discount: 0,
    payment: { method: 'Pay on delivery', status: 'pending' },
    requestId: req.id,
  };
  db.orders.unshift(order);
  return order;
}

