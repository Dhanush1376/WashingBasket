/**
 * FRONTEND-ONLY MOCK DATABASE for the admin portal.
 *
 * Loads the JSON in src/mock/data into memory. Every change made in the portal (editing an offer,
 * moving an order along, hiding a home page section) updates this in-memory copy only: nothing is
 * sent to a server and a page refresh brings the sample data back. To go live, replace the service
 * modules in this folder with real API calls; pages only ever call the service functions.
 */
import addresses from '@/mock/data/addresses.json';
import admin from '@/mock/data/admin.json';
import customers from '@/mock/data/customers.json';
import faq from '@/mock/data/faq.json';
import homepage from '@/mock/data/homepage.json';
import notifications from '@/mock/data/notifications.json';
import offers from '@/mock/data/offers.json';
import orders from '@/mock/data/orders.json';
import pickupSlots from '@/mock/data/pickup-slots.json';
import pricing from '@/mock/data/pricing.json';
import referralProgram from '@/mock/data/referral-program.json';
import referrals from '@/mock/data/referrals.json';
import requests from '@/mock/data/requests.json';
import serviceAreas from '@/mock/data/service-areas.json';
import services from '@/mock/data/services.json';
import support from '@/mock/data/support.json';
import walletSettings from '@/mock/data/wallet-settings.json';
import walletTransactions from '@/mock/data/wallet-transactions.json';
import type {
  AdminNotification,
  AdminOffer,
  AdminOrder,
  AdminPickupSlots,
  AdminProfile,
  AdminReferral,
  AdminRequest,
  AdminService,
  AdminWalletTxn,
  Customer,
  CustomerAddress,
  Faq,
  HomepageContent,
  Pricing,
  ReferralProgramSettings,
  ServiceArea,
  SupportData,
  WalletConfig,
} from '@/types';

/** Deep copy, so nothing outside this folder can change the mock data by accident. */
export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export const db = {
  admin: clone(admin) as AdminProfile,
  customers: clone(customers) as Customer[],
  addresses: clone(addresses) as CustomerAddress[],
  orders: clone(orders) as AdminOrder[],
  requests: clone(requests) as AdminRequest[],
  wallet: clone(walletTransactions) as AdminWalletTxn[],
  walletSettings: clone(walletSettings) as WalletConfig,
  offers: clone(offers) as AdminOffer[],
  services: clone(services) as AdminService[],
  pricing: clone(pricing) as Pricing,
  pickupSlots: clone(pickupSlots) as AdminPickupSlots,
  serviceAreas: clone(serviceAreas) as ServiceArea[],
  referrals: clone(referrals) as AdminReferral[],
  referralProgram: clone(referralProgram) as ReferralProgramSettings,
  notifications: clone(notifications) as AdminNotification[],
  support: clone(support) as SupportData,
  faq: clone(faq) as Faq[],
  homepage: clone(homepage) as HomepageContent,
};

/** Simulated network delay: long enough to show loading states, short enough not to annoy. */
export const MOCK_LATENCY_MS = 320;

/**
 * Development aid: open the portal with `?fail=orders` (or any service name, or `all`) and that
 * service's reads fail, so the error states can be seen and checked.
 */
function shouldFail(scope: string): boolean {
  if (typeof window === 'undefined') return false;
  const fail = new URLSearchParams(window.location.search).get('fail');
  return !!fail && (fail === 'all' || fail.split(',').includes(scope));
}

export class MockServiceError extends Error {}

/** Resolve with a copy of the data after the simulated delay. */
export function respond<T>(data: T, scope = '', ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (scope && shouldFail(scope)) reject(new MockServiceError(`Sample ${scope} data could not be loaded (simulated with ?fail).`));
      else resolve(clone(data));
    }, ms),
  );
}

/** Newest first, comparing real instants. */
export const newest = (a: string, b: string) => Date.parse(b) - Date.parse(a);

/** Next id in the style of the existing ones ("of-5" → "of-6"). */
export function nextId(existing: string[], prefix: string): string {
  const max = existing.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0);
  return `${prefix}${max + 1}`;
}

/**
 * Now, written in India time like every date in the sample data ("2026-11-05T09:30:00+05:30"),
 * so new records sort correctly next to the existing ones.
 */
export const nowIso = () => {
  const ist = new Date(Date.now() + 330 * 60_000);
  return `${ist.toISOString().slice(0, 19)}+05:30`;
};
