/**
 * FRONTEND-ONLY MOCK DATABASE.
 *
 * Loads the JSON datasets in src/mock-data into memory so the app can be used end to end
 * without a backend. Changes (bookings, cancellations, read states, profile edits) live only
 * for the current app session and are never sent anywhere. Replace the services in this folder
 * with real API calls to go live; screens depend only on the service functions.
 */
import addresses from '../../mock-data/addresses.json';
import dashboard from '../../mock-data/dashboard.json';
import faq from '../../mock-data/faq.json';
import notifications from '../../mock-data/notifications.json';
import offers from '../../mock-data/offers.json';
import orders from '../../mock-data/orders.json';
import pickupSlots from '../../mock-data/pickup-slots.json';
import priceMenu from '../../mock-data/price-menu.json';
import referralCodes from '../../mock-data/referral-codes.json';
import referrals from '../../mock-data/referrals.json';
import requests from '../../mock-data/requests.json';
import services from '../../mock-data/services.json';
import support from '../../mock-data/support.json';
import user from '../../mock-data/user.json';
import wallet from '../../mock-data/wallet.json';
import type {
  Address,
  AppNotification,
  Dashboard,
  Faq,
  Offer,
  Order,
  PickupRequest,
  PickupSlots,
  MenuSection,
  PriceMenu,
  PriceUnit,
  Pricing,
  ReferralCodeRules,
  ReferralProgram,
  Service,
  SupportInfo,
  User,
  WalletConfig,
  WalletTxn,
} from '../../types/models';

// deep copy so callers can never mutate the db (undefined can't round-trip through JSON)
export const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const UNIT: Record<MenuSection['unit'], PriceUnit> = { kg: 'kg', pair: 'pair', pc: 'piece' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Booking's per-item prices, built from the printed price list so there is only one list to keep up to date.
 * Each item's id is its section and name ("only-wash-normal-wash"); blankets become two items each, single and double.
 */
function pricingFrom(menu: PriceMenu): Pricing {
  return {
    currency: 'INR',
    fees: menu.fees,
    categories: menu.sections.map((s) => ({
      serviceId: s.id,
      note: s.note,
      items: s.items.flatMap((it) => {
        const base = `${s.id}-${slug(it.name)}`;
        if (!s.columns || it.price2 === undefined) return [{ id: base, name: it.name, price: it.price, unit: UNIT[s.unit] }];
        const [one, two] = s.columns;
        return [
          { id: `${base}-${slug(one)}`, name: `${it.name} · ${one}`, price: it.price, unit: UNIT[s.unit] },
          { id: `${base}-${slug(two)}`, name: `${it.name} · ${two}`, price: it.price2, unit: UNIT[s.unit] },
        ];
      }),
    })),
  };
}

export const db = {
  user: clone(user) as User,
  addresses: clone(addresses) as Address[],
  services: clone(services) as Service[],
  priceMenu: clone(priceMenu) as PriceMenu,
  pricing: pricingFrom(priceMenu as PriceMenu),
  pickupSlots: clone(pickupSlots) as PickupSlots,
  orders: clone(orders) as Order[],
  requests: clone(requests) as PickupRequest[],
  wallet: clone(wallet.transactions) as WalletTxn[],
  walletConfig: clone({ presets: wallet.presets, limits: wallet.limits, topUpBonus: wallet.topUpBonus }) as WalletConfig,
  offers: clone(offers) as Offer[],
  referrals: clone(referrals) as ReferralProgram,
  referralCodes: clone(referralCodes) as { rules: ReferralCodeRules; codes: { code: string; owner: string }[] },
  notifications: clone(notifications) as AppNotification[],
  support: clone(support) as SupportInfo,
  faq: clone(faq) as Faq[],
  dashboard: clone(dashboard) as Dashboard,
};

/** Simulated network latency, kept short: enough to show loading states, never enough to annoy. */
export const MOCK_LATENCY_MS = 260;

/** Resolve with a copy of the data after the simulated latency (callers can't mutate the db). */
export function respond<T>(data: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(clone(data)), ms));
}

/** Newest first, comparing real instants (mock dates carry +05:30, new records are UTC). */
export const newest = (a: string, b: string) => Date.parse(b) - Date.parse(a);

/** Next sequential id in the style of the existing ones ("RQ2045" → "RQ2046"). */
export function nextId(existing: string[], prefix: string): string {
  const max = existing.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0);
  return `${prefix}${max + 1}`;
}
