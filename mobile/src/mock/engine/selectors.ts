/** Read-only views of the state. Every screen derives its numbers from these, so they always agree. */
import type { CatalogItem, LaundryOrder, Location, MockState, QrToken, ServiceMode, Staff } from '../types.ts';
import { isOpen, statusGroup, type StatusGroup } from './lifecycle.ts';
import { isPast } from './util.ts';

/** Balance is always derived from completed transactions, so it can never disagree with the history. */
export function walletBalance(s: MockState, customerId: string): number {
  return s.walletTransactions
    .filter((t) => t.customerId === customerId && t.status === 'completed')
    .reduce((sum, t) => sum + (t.type === 'debit' ? -t.amount : t.amount), 0);
}

export function walletPending(s: MockState, customerId: string): number {
  return s.walletTransactions
    .filter((t) => t.customerId === customerId && t.status === 'pending')
    .reduce((sum, t) => sum + (t.type === 'debit' ? -t.amount : t.amount), 0);
}

export const findOrder = (s: MockState, id: string) => s.orders.find((o) => o.id === id);
export const findLocation = (s: MockState, id: string) => s.locations.find((l) => l.id === id);
export const findCustomer = (s: MockState, id: string) => s.customers.find((c) => c.id === id);
export const findStaff = (s: MockState, id: string) => s.staff.find((x) => x.id === id);
export const findQr = (s: MockState, id: string | undefined) => (id ? s.qrTokens.find((q) => q.id === id) : undefined);
export const findReceipt = (s: MockState, orderId: string) => s.receipts.find((r) => r.orderId === orderId);

export function catalogItem(s: MockState, itemId: string): { item: CatalogItem; categoryId: string; categoryName: string } | undefined {
  for (const c of s.catalog.categories) {
    const item = c.items.find((i) => i.id === itemId);
    if (item) return { item, categoryId: c.id, categoryName: c.name };
  }
  return undefined;
}

/** The service charge for an order of this mode and subtotal. */
export function serviceChargeFor(s: MockState, mode: ServiceMode, subtotal: number): number {
  const rule = s.catalog.serviceCharges[mode];
  if (!rule || subtotal === 0) return 0;
  if (rule.freeAbove !== undefined && subtotal >= rule.freeAbove) return 0;
  return rule.fee;
}

/** Totals for a basket, priced from the catalog. */
export function priceBasket(s: MockState, mode: ServiceMode, basket: { itemId: string; qty: number }[]) {
  const lines = basket
    .filter((b) => b.qty > 0)
    .map((b) => {
      const found = catalogItem(s, b.itemId);
      return found ? { ...found, qty: b.qty, amount: found.item.price * b.qty } : null;
    })
    .filter((l): l is NonNullable<typeof l> => !!l);
  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  const serviceCharge = serviceChargeFor(s, mode, subtotal);
  return { lines, subtotal, pieces, serviceCharge, total: subtotal + serviceCharge };
}

/** A QR is usable when active and not past its expiry. */
export function qrState(q: QrToken | undefined, now: string): 'MISSING' | 'LOCKED' | 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'REVOKED' {
  if (!q) return 'MISSING';
  if (q.status === 'ACTIVE' && isPast(q.expiresAt, now)) return 'EXPIRED';
  return q.status;
}

export const ordersForCustomer = (s: MockState, customerId: string) =>
  s.orders.filter((o) => o.customerId === customerId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

export const ordersForLocation = (s: MockState, locationId: string) =>
  s.orders.filter((o) => o.locationId === locationId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

export const openIssueFor = (s: MockState, orderId: string) => s.issues.find((i) => i.orderId === orderId && i.status === 'OPEN');

export type GroupCounts = Record<StatusGroup, number> & { total: number };

export function countByGroup(orders: LaundryOrder[]): GroupCounts {
  const out: GroupCounts = { total: orders.length, pending: 0, accepted: 0, processing: 0, ready: 0, delivered: 0, rejected: 0, cancelled: 0 };
  orders.forEach((o) => (out[statusGroup(o.status)] += 1));
  return out;
}

export function locationStats(s: MockState, loc: Location) {
  const orders = s.orders.filter((o) => o.locationId === loc.id);
  const staff = s.staff.filter((x) => x.locationId === loc.id);
  const revenue = orders.filter((o) => o.payment.status === 'COMPLETED').reduce((n, o) => n + o.total, 0);
  return { counts: countByGroup(orders), open: orders.filter((o) => isOpen(o.status)).length, staff, revenue };
}

/** Orders a staff member is working on (accepted by them or at their location and still open). */
export function activeOrdersForStaff(s: MockState, st: Staff) {
  return s.orders.filter((o) => o.locationId === st.locationId && isOpen(o.status) && [o.acceptedBy, o.processingBy, o.readyBy, o.handoverBy].includes(st.id));
}

export const activitiesFor = (s: MockState, orderId: string) => s.activities.filter((a) => a.orderId === orderId);

/** When the order first reached each status, for the timeline. */
export function statusTimes(s: MockState, orderId: string): Partial<Record<string, string>> {
  const out: Record<string, string> = {};
  [...activitiesFor(s, orderId)].reverse().forEach((a) => {
    if (a.type === 'STATUS_CHANGED' && a.to && !out[a.to]) out[a.to] = a.at;
  });
  return out;
}

export const isPaid = (o: LaundryOrder) => o.payment.status === 'COMPLETED';
