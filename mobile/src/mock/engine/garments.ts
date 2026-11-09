/** Garment lists per service, and how a list of garments turns into the quantity a service is billed for. */
import { GARMENTS, GARMENT_GROUPS, SERVICE_GARMENTS, type Garment, type GarmentGroup } from '../data/garments.ts';
import type { CatalogItem, OrderGarment, OrderLine } from '../types.ts';

export type GarmentPick = { garmentId: string; qty: number };

const BY_ID = new Map(GARMENTS.map((g) => [g.id, g]));

export const findGarment = (id: string): Garment | undefined => BY_ID.get(id);

/** The garments a price-list category takes, grouped into tabs in the catalogue's order. Empty groups are left out. */
export function garmentGroupsFor(categoryId: string): { group: GarmentGroup; garments: Garment[] }[] {
  const ids = new Set(SERVICE_GARMENTS[categoryId] ?? []);
  return GARMENT_GROUPS.map((group) => ({ group, garments: GARMENTS.filter((g) => g.group === group.id && ids.has(g.id)) })).filter(
    (x) => x.garments.length > 0,
  );
}

export const serviceTakesGarment = (categoryId: string, garmentId: string) => (SERVICE_GARMENTS[categoryId] ?? []).includes(garmentId);

export const garmentCount = (picks: GarmentPick[]) => picks.reduce((n, p) => n + Math.max(0, p.qty), 0);

/** Typical weight of the listed garments, in kg (unrounded). */
export const estimatedKg = (picks: GarmentPick[]) => picks.reduce((n, p) => n + (findGarment(p.garmentId)?.weightKg ?? 0) * Math.max(0, p.qty), 0);

/**
 * The quantity a service line is billed for, given its garments: the number of pieces (or pairs), or for a per-kg
 * service the estimated weight rounded to a whole kilo, at least 1 kg. Staff weigh the clothes at the counter.
 */
export function billedQty(unit: CatalogItem['unit'], picks: GarmentPick[]): number {
  const count = garmentCount(picks);
  if (count === 0) return 0;
  if (unit !== 'kg') return count;
  return Math.max(1, Math.round(estimatedKg(picks)));
}

/** Clothes staff should count on an order: listed garments, or the line quantity for lines without a list (per-kg lines without a list count as 0). */
export function piecesToCount(lines: OrderLine[]): number {
  return lines.reduce((n, l) => n + (l.garments?.length ? l.garments.reduce((s, g) => s + g.qty, 0) : l.unit === 'kg' ? 0 : l.qty), 0);
}

/** "× 3", or "~2 kg" for a per-kg line. */
export const lineQtyLabel = (l: Pick<OrderLine, 'unit' | 'qty'>) => (l.unit === 'kg' ? `~${l.qty} kg` : `× ${l.qty}`);

/** The order-line copy of a garment list (only garments with a count, in catalogue order). */
export function orderGarments(picks: GarmentPick[]): OrderGarment[] {
  const qty = new Map<string, number>();
  for (const p of picks) if (p.qty > 0) qty.set(p.garmentId, (qty.get(p.garmentId) ?? 0) + p.qty);
  return GARMENTS.filter((g) => qty.has(g.id)).map((g) => ({ garmentId: g.id, name: g.name, icon: g.icon, groupId: g.group, qty: qty.get(g.id)! }));
}
