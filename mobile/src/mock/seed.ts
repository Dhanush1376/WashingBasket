/**
 * The demo's starting data: every JSON file in src/mock/data, built into one state. Used by the customer app and
 * the admin portal alike. Regenerate the order files with `npm run laundry:seed`.
 */
import priceMenu from '../mock-data/price-menu.json';
import customers from './data/customers.json';
import issues from './data/issues.json';
import locations from './data/locations.json';
import notifications from './data/notifications.json';
import orderActivities from './data/orderActivities.json';
import orders from './data/orders.json';
import priceList from './data/priceList.json';
import qrTokens from './data/qrTokens.json';
import receipts from './data/receipts.json';
import staff from './data/staff.json';
import walletAccounts from './data/walletAccounts.json';
import walletTransactions from './data/walletTransactions.json';
import { buildState, type SeedFiles } from './engine/seed.ts';
import type { MockState } from './types.ts';

const files = {
  locations,
  priceList,
  priceMenu,
  customers,
  staff,
  walletAccounts,
  walletTransactions,
  orders,
  qrTokens,
  receipts,
  issues,
  notifications,
  orderActivities,
} as unknown as SeedFiles;

export function seedState(): MockState {
  return buildState(files, new Date().toISOString());
}

/** The demo staff sign-in, as written in staff.json. MOCK credentials, not security. */
export const STAFF_DEMO_LOGIN = (staff as { demoLogin: { phone: string; otp: string; note: string } }).demoLogin;
