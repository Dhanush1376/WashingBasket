/** Joins between the mock tables, worked out the same way the customer app does it. */
import type { AdminOrder, AdminWalletTxn, OrderTotals, ServiceId } from '@/types';
import { db } from './db';

export const customerName = (id: string | null | undefined) => db.customers.find((c) => c.id === id)?.fullName ?? 'Unknown customer';

export const serviceName = (id: ServiceId) => db.services.find((s) => s.id === id)?.name ?? id;

export const slotLabel = (id: string) => db.pickupSlots.slots.find((s) => s.id === id)?.label ?? 'Slot removed';

export function addressLine(id: string) {
  const a = db.addresses.find((x) => x.id === id);
  return a ? `${a.line1}, ${a.line2}` : 'Address removed';
}

export function priceItem(id: string) {
  for (const c of db.pricing.categories) {
    const item = c.items.find((i) => i.id === id);
    if (item) return item;
  }
  return undefined;
}

/** All amounts come from the price list: orders store only item ids and quantities (as in the customer app). */
export function orderTotals(order: Pick<AdminOrder, 'items' | 'discount'>): OrderTotals {
  const lines = order.items
    .map(({ priceItemId, qty }) => {
      const item = priceItem(priceItemId);
      return item ? { item, qty, amount: item.price * qty } : null;
    })
    .filter((l): l is NonNullable<typeof l> => !!l && l.qty > 0);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const { delivery: fee, freeDeliveryAbove } = db.pricing.fees;
  const delivery = subtotal === 0 || subtotal >= freeDeliveryAbove ? 0 : fee;
  const garments = lines.reduce((n, l) => n + (l.item.unit === 'kg' ? 0 : l.qty), 0);
  return { lines, garments, subtotal, delivery, discount: order.discount, total: Math.max(0, subtotal + delivery - order.discount) };
}

/** "11 garments", "5 kg", "Not counted yet". */
export function itemsLabel(order: Pick<AdminOrder, 'items' | 'discount'>) {
  const t = orderTotals(order);
  if (!t.lines.length) return 'Not counted yet';
  const kg = t.lines.filter((l) => l.item.unit === 'kg').reduce((s, l) => s + l.qty, 0);
  const parts = [];
  if (t.garments) parts.push(`${t.garments} ${t.garments === 1 ? 'item' : 'items'}`);
  if (kg) parts.push(`${kg} kg`);
  return parts.join(' + ');
}

export const signed = (t: AdminWalletTxn) => (t.type === 'debit' ? -t.amount : t.amount);

/** Balance from completed entries only, so it always agrees with the history (as in the customer app). */
export function walletFor(customerId: string) {
  const mine = db.wallet.filter((t) => t.customerId === customerId);
  return {
    balance: mine.filter((t) => t.status === 'completed').reduce((s, t) => s + signed(t), 0),
    pending: mine.filter((t) => t.status === 'pending').reduce((s, t) => s + signed(t), 0),
    entries: mine,
  };
}

export const isActiveOrder = (o: AdminOrder) => o.status !== 'delivered' && o.status !== 'cancelled';
