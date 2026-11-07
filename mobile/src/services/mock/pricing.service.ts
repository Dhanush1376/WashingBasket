import type { MenuItem, MenuSection, OrderItem, OrderTotals, PriceItem, PriceMenu, Pricing, Service, ServiceId } from '../../types/models';
import { db, respond } from './db';

export type { MenuItem, MenuSection, PriceMenu };

/** The price list exactly as printed, for the Price list page. */
export function getPriceMenu(): Promise<PriceMenu> {
  return respond(db.priceMenu);
}

export function getServices(): Promise<Service[]> {
  return respond(db.services);
}

export function getPricing(): Promise<Pricing> {
  return respond(db.pricing);
}

/** Synchronous lookups for already-loaded data (pricing is static for the session). */
export function serviceById(id: ServiceId): Service {
  return db.services.find((s) => s.id === id) ?? db.services[0];
}

export function priceItemById(id: string): PriceItem | undefined {
  for (const c of db.pricing.categories) {
    const item = c.items.find((i) => i.id === id);
    if (item) return item;
  }
  return undefined;
}

export function itemsForService(serviceId: ServiceId): PriceItem[] {
  return db.pricing.categories.find((c) => c.serviceId === serviceId)?.items ?? [];
}

/** All amounts come from the price list (price-menu.json): orders store only item ids and quantities. */
export function computeTotals(items: OrderItem[], discount = 0): OrderTotals {
  const lines = items
    .map(({ priceItemId, qty }) => {
      const item = priceItemById(priceItemId);
      return item ? { item, qty, amount: item.price * qty } : null;
    })
    .filter((l): l is NonNullable<typeof l> => !!l && l.qty > 0);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const { delivery: fee, freeDeliveryAbove } = db.pricing.fees;
  const delivery = subtotal === 0 || subtotal >= freeDeliveryAbove ? 0 : fee;
  const garments = lines.reduce((n, l) => n + (l.item.unit === 'kg' ? 0 : l.qty), 0);
  return { lines, garments, subtotal, delivery, discount, total: Math.max(0, subtotal + delivery - discount) };
}

/** Lowest unit price for a service, for "from ₹45 / kg" labels. */
export function startingPrice(serviceId: ServiceId): PriceItem | undefined {
  return [...itemsForService(serviceId)].sort((a, b) => a.price - b.price)[0];
}
