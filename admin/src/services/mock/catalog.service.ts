/** Services and the price list (the customer app's Price List and the service cards on Home). */
import type { AdminService, PriceItem, Pricing, ServiceId } from '@/types';
import { db, respond } from './db';

export type ServiceRow = AdminService & { items: number; startingPrice: PriceItem | null; ordersLast30: number };

const byPosition = (a: AdminService, b: AdminService) => a.position - b.position;

function toRow(s: AdminService): ServiceRow {
  const items = db.pricing.categories.find((c) => c.serviceId === s.id)?.items ?? [];
  const since = Date.now() - 30 * 86400_000;
  return {
    ...s,
    items: items.length,
    startingPrice: [...items].sort((a, b) => a.price - b.price)[0] ?? null,
    ordersLast30: db.orders.filter((o) => o.serviceId === s.id && Date.parse(o.placedAt) >= since).length,
  };
}

export function listServices(): Promise<ServiceRow[]> {
  return respond([...db.services].sort(byPosition).map(toRow), 'services');
}

export type ServiceInput = Pick<AdminService, 'name' | 'tagline' | 'description' | 'turnaround' | 'art'>;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/** SIMULATED */
export function updateService(id: ServiceId, input: ServiceInput): Promise<AdminService> {
  const s = db.services.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('Service not found'));
  Object.assign(s, { ...input, name: input.name.trim(), tagline: input.tagline.trim(), description: input.description.trim(), turnaround: input.turnaround.trim() });
  return respond(s, 'services', 450);
}

/** SIMULATED: creates a new service and adds its empty pricing category */
export function addService(input: ServiceInput): Promise<AdminService> {
  const maxPos = Math.max(0, ...db.services.map((s) => s.position));
  let baseId = slug(input.name) || 'service';
  let id = baseId;
  let counter = 2;
  while (db.services.some((s) => s.id === id)) {
    id = `${baseId}-${counter++}`;
  }
  const newService: AdminService = {
    id: id as ServiceId,
    name: input.name.trim(),
    tagline: input.tagline.trim(),
    description: input.description.trim(),
    turnaround: input.turnaround.trim(),
    art: input.art || 'washing',
    available: true,
    position: maxPos + 1,
  };
  db.services.push(newService);
  if (!db.pricing.categories.some((c) => c.serviceId === id)) {
    db.pricing.categories.push({
      serviceId: id as ServiceId,
      note: '',
      items: [],
    });
  }
  return respond(newService, 'services', 400);
}

/** SIMULATED: deletes a service and its pricing category */
export function deleteService(id: ServiceId): Promise<void> {
  db.services = db.services.filter((s) => s.id !== id);
  db.pricing.categories = db.pricing.categories.filter((c) => c.serviceId !== id);
  return respond(undefined, 'services', 350);
}

/** SIMULATED: an unavailable service stays on the price list but can't be booked. */
export function setServiceAvailable(id: ServiceId, available: boolean): Promise<AdminService> {
  const s = db.services.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('Service not found'));
  s.available = available;
  return respond(s, 'services', 300);
}

/** SIMULATED */
export function moveService(id: ServiceId, direction: -1 | 1): Promise<ServiceRow[]> {
  const list = [...db.services].sort(byPosition);
  const i = list.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) [list[i].position, list[j].position] = [list[j].position, list[i].position];
  return listServices();
}

export function getPricing(): Promise<Pricing> {
  return respond(db.pricing, 'services');
}

export type PriceItemInput = Omit<PriceItem, 'id'>;

/** SIMULATED: adds a line to a service's price list. Existing orders keep their items. */
export function addPriceItem(serviceId: ServiceId, input: PriceItemInput): Promise<PriceItem> {
  const cat = db.pricing.categories.find((c) => c.serviceId === serviceId);
  if (!cat) return Promise.reject(new Error('Service not found'));
  const prefix = serviceId.split('-').map((w) => w[0]).join('');
  let id = `${prefix}-${slug(input.name) || 'item'}`;
  let n = 2;
  while (db.pricing.categories.some((c) => c.items.some((i) => i.id === id))) id = `${prefix}-${slug(input.name)}-${n++}`;
  const item: PriceItem = { id, name: input.name.trim(), price: input.price, unit: input.unit };
  cat.items.push(item);
  return respond(item, 'services', 400);
}

/** SIMULATED: new prices apply to every order that uses this item (orders store items, not amounts). */
export function updatePriceItem(itemId: string, input: PriceItemInput): Promise<PriceItem> {
  for (const c of db.pricing.categories) {
    const item = c.items.find((i) => i.id === itemId);
    if (item) {
      Object.assign(item, { ...input, name: input.name.trim() });
      return respond(item, 'services', 400);
    }
  }
  return Promise.reject(new Error('Price item not found'));
}

/** True when an order still counts this item, so the team is warned before removing it. */
export function priceItemInUse(itemId: string) {
  return db.orders.filter((o) => o.items.some((i) => i.priceItemId === itemId)).length;
}

/** SIMULATED */
export function deletePriceItem(itemId: string): Promise<void> {
  db.pricing.categories.forEach((c) => (c.items = c.items.filter((i) => i.id !== itemId)));
  return respond(undefined, 'services', 350);
}

/** SIMULATED: also updates the category note shown on the Price List. */
export function updateCategoryNote(serviceId: ServiceId, note: string): Promise<void> {
  const cat = db.pricing.categories.find((c) => c.serviceId === serviceId);
  if (cat) cat.note = note.trim();
  return respond(undefined, 'services', 300);
}

/** SIMULATED */
export function updateFees(fees: Pricing['fees']): Promise<Pricing> {
  db.pricing.fees = { ...fees };
  return respond(db.pricing, 'services', 400);
}
