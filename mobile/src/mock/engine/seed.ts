/**
 * Builds the starting state from the JSON files in src/mock/data. Pure: the JSON is passed in, so the app, the
 * admin portal, the seed generator and the tests all build exactly the same state.
 */
import type {
  Catalog,
  CatalogItem,
  Counters,
  Customer,
  DeliveryIssue,
  GarmentIcon,
  LaundryNotification,
  LaundryOrder,
  Location,
  MockState,
  OrderActivity,
  QrToken,
  Receipt,
  ServiceCharge,
  ServiceMode,
  Staff,
  WalletAccount,
  WalletTransaction,
} from '../types.ts';
import { addMinutes, clone } from './util.ts';

/** Bump when the shape changes: stored demo data with another version is replaced by a fresh seed. */
export const SCHEMA_VERSION = 15;

type RawItem = { id: string; name: string; icon: string; unit: 'piece' | 'pair' | 'kg'; price?: number; note?: string; menuRef?: { section: string; item: string; column?: 0 | 1 } };
export type RawPriceList = {
  currency: 'INR';
  note: string;
  illustrativeNote: string;
  serviceCharges: Record<ServiceMode, ServiceCharge>;
  categories: { id: string; name: string; description: string; items: RawItem[] }[];
};
export type RawPriceMenu = { sections: { id: string; items: { name: string; price: number; price2?: number }[] }[] };

/** Items with a `menuRef` take their price from the printed price list, so there is one list to keep up to date. */
export function resolveCatalog(raw: RawPriceList, menu: RawPriceMenu): Catalog {
  return {
    currency: raw.currency,
    note: raw.note,
    illustrativeNote: raw.illustrativeNote,
    serviceCharges: raw.serviceCharges,
    categories: raw.categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: c.items.map((it): CatalogItem => {
        let price = it.price;
        if (it.menuRef) {
          const ref = it.menuRef;
          const found = menu.sections.find((s) => s.id === ref.section)?.items.find((m) => m.name === ref.item);
          if (!found) throw new Error(`Price list item ${it.id} points at a missing printed item (${ref.section} / ${ref.item}).`);
          price = ref.column === 1 ? found.price2 : found.price;
        }
        if (price === undefined) throw new Error(`Price list item ${it.id} has no price.`);
        return { id: it.id, name: it.name, icon: it.icon as GarmentIcon, unit: it.unit, price, priceSource: it.menuRef ? 'printed-list' : 'illustrative', note: it.note };
      }),
    })),
  };
}

export type SeedFiles = {
  locations: Location[];
  priceList: RawPriceList;
  priceMenu: RawPriceMenu;
  customers: Customer[];
  staff: { staff: Staff[] };
  walletAccounts: WalletAccount[];
  walletTransactions: WalletTransaction[];
  orders: LaundryOrder[];
  qrTokens: QrToken[];
  receipts: Receipt[];
  issues: DeliveryIssue[];
  notifications: LaundryNotification[];
  orderActivities: OrderActivity[];
};

const num = (id: string) => Number(id.replace(/\D/g, '')) || 0;
const maxOf = (ids: string[], floor: number) => ids.reduce((m, id) => Math.max(m, num(id)), floor);

export function buildState(f: SeedFiles, now: string): MockState {
  const qrTokens = clone(f.qrTokens);
  // seeded QR codes that are still usable stay usable for their full life from the moment the demo starts
  qrTokens.forEach((q) => {
    if (q.status === 'ACTIVE') {
      q.activatedAt = now;
      q.expiresAt = addMinutes(now, q.ttlMinutes);
    }
  });
  const counters: Counters = {
    order: maxOf(f.orders.map((o) => o.id), 1000),
    receipt: maxOf(f.receipts.map((r) => r.number), 240000),
    txn: maxOf(f.walletTransactions.map((t) => t.id), 0),
    qr: maxOf(f.qrTokens.map((q) => q.id), 0),
    notification: maxOf(f.notifications.map((n) => n.id), 0),
    activity: maxOf(f.orderActivities.map((a) => a.id), 0),
    issue: maxOf(f.issues.map((i) => i.id), 0),
    customer: maxOf(f.customers.map((c) => c.id), 2000),
  };
  return {
    schema: SCHEMA_VERSION,
    seededAt: now,
    counters,
    locations: clone(f.locations).sort((a, b) => a.sortOrder - b.sortOrder),
    catalog: resolveCatalog(f.priceList, f.priceMenu),
    customers: clone(f.customers),
    staff: clone(f.staff.staff),
    orders: clone(f.orders),
    walletAccounts: clone(f.walletAccounts),
    walletTransactions: clone(f.walletTransactions),
    qrTokens,
    receipts: clone(f.receipts),
    issues: clone(f.issues),
    notifications: clone(f.notifications),
    activities: clone(f.orderActivities),
  };
}
