/** Node helpers for the laundry seed generator and scenario tests: read the JSON files without a bundler. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SeedFiles } from '../../src/mock/engine/seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '../../src/mock/data');
const MENU = join(here, '../../src/mock-data/price-menu.json');

const read = (name: string) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
const readOr = (name: string, fallback: unknown) => {
  try {
    return read(name);
  } catch {
    return fallback;
  }
};

/** The hand-written files only (no orders yet): the generator's starting point. */
export function staticFiles(): SeedFiles {
  return {
    locations: read('locations.json'),
    priceList: read('priceList.json'),
    priceMenu: JSON.parse(readFileSync(MENU, 'utf8')),
    customers: read('customers.json'),
    staff: read('staff.json'),
    walletAccounts: [],
    walletTransactions: [],
    orders: [],
    qrTokens: [],
    receipts: [],
    issues: [],
    notifications: [],
    orderActivities: [],
  };
}

/** Everything, as the apps load it. */
export function allFiles(): SeedFiles {
  return {
    ...staticFiles(),
    walletAccounts: readOr('walletAccounts.json', []),
    walletTransactions: readOr('walletTransactions.json', []),
    orders: readOr('orders.json', []),
    qrTokens: readOr('qrTokens.json', []),
    receipts: readOr('receipts.json', []),
    issues: readOr('issues.json', []),
    notifications: readOr('notifications.json', []),
    orderActivities: readOr('orderActivities.json', []),
  };
}

export function writeData(name: string, value: unknown) {
  writeFileSync(join(DATA_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
}
