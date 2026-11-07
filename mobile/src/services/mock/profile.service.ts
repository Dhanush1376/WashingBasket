/**
 * Profile data, served from the JSON in src/mock-data/profile and nowhere else. Swap these
 * functions for real API calls later; the Profile screen only ever talks to this file.
 */
import addressesJson from '../../mock-data/profile/addresses.json';
import calendarJson from '../../mock-data/profile/laundry-calendar.json';
import customerJson from '../../mock-data/profile/customer.json';
import membershipJson from '../../mock-data/profile/membership.json';
import ordersJson from '../../mock-data/profile/recent-orders.json';
import statisticsJson from '../../mock-data/profile/statistics.json';
import walletJson from '../../mock-data/profile/wallet.json';
import type {
  CustomerProfile,
  LaundryEvent,
  LaundryEventDetail,
  Membership,
  ProfileAddress,
  ProfileStatistics,
  ProfileWallet,
  RecentOrder,
  WalletDetails,
} from '../../types/profile';
import { clone, newest, nextId, respond } from './db';

// a working copy, so edits made this session (name, email, default address) stick until reload
const store = {
  customer: clone(customerJson) as CustomerProfile,
  wallet: clone(walletJson) as ProfileWallet,
  statistics: clone(statisticsJson) as ProfileStatistics,
  addresses: clone(addressesJson) as ProfileAddress[],
  orders: clone(ordersJson) as RecentOrder[],
  calendar: clone(calendarJson) as LaundryEvent[],
  membership: clone(membershipJson) as Membership,
};

export function getCustomerProfile(): Promise<CustomerProfile> {
  return respond(store.customer);
}

export function updateCustomerProfile(patch: Partial<Pick<CustomerProfile, 'fullName' | 'email' | 'avatarUrl'>>): Promise<CustomerProfile> {
  store.customer = { ...store.customer, ...patch };
  return respond(store.customer);
}

/** Balance and pending credit are summed from the transactions, so they always reconcile. */
export function getWalletDetails(): Promise<WalletDetails> {
  const signed = (t: ProfileWallet['transactions'][number]) => (t.type === 'debit' ? -t.amount : t.amount);
  const balance = store.wallet.transactions.filter((t) => t.status === 'completed').reduce((s, t) => s + signed(t), 0);
  const pending = store.wallet.transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + signed(t), 0);
  const transactions = [...store.wallet.transactions].sort((a, b) => newest(a.date, b.date));
  return respond({ balance, pending, transactions });
}

export function getProfileStatistics(): Promise<ProfileStatistics> {
  return respond(store.statistics);
}

export function getSavedAddresses(): Promise<ProfileAddress[]> {
  return respond([...store.addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)));
}

export function setDefaultProfileAddress(id: string): Promise<ProfileAddress[]> {
  store.addresses = store.addresses.map((a) => ({ ...a, isDefault: a.id === id }));
  return getSavedAddresses();
}

/** Keeps the profile's list in step when a new address is saved from the Add address screen. */
export function addProfileAddress(input: Omit<ProfileAddress, 'id' | 'isDefault' | 'pickupInstructions'>): Promise<ProfileAddress> {
  const address: ProfileAddress = {
    ...input,
    id: nextId(store.addresses.map((a) => a.id), 'a-'),
    isDefault: store.addresses.length === 0,
    pickupInstructions: null,
  };
  store.addresses.push(address);
  return respond(address);
}

/** Newest first. */
export function getRecentOrders(limit?: number): Promise<RecentOrder[]> {
  const sorted = [...store.orders].sort((a, b) => newest(a.placedAt, b.placedAt));
  return respond(limit ? sorted.slice(0, limit) : sorted);
}

export function getMembershipDetails(): Promise<Membership> {
  return respond(store.membership);
}

/** Calendar day key in the customer's own time zone, e.g. "2026-11-02". */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Laundry events in one month (month is 1–12), oldest first, each carrying its order's summary.
 * Only recorded events are returned; nothing is inferred from when an order was placed.
 */
export function getLaundryCalendarEvents(month: number, year: number): Promise<LaundryEventDetail[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const todayKey = dayKey(new Date().toISOString());
  const events = store.calendar
    .filter((e) => dayKey(e.at).startsWith(prefix))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((e) => {
      const order = store.orders.find((o) => o.id === e.orderId) ?? null;
      let type = e.type;
      // Future events cannot be in the past tense (e.g. delivered); they are scheduled
      if (dayKey(e.at) > todayKey && (type === 'delivered' || type === 'handover' || type === 'cancelled')) {
        type = 'scheduled_pickup';
      }
      return { ...e, type, order };
    });
  return respond(events);
}
