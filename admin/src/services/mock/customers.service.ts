import type { AdminReferral, AdminTicket, AdminWalletTxn, Customer, CustomerAddress, CustomerStatus } from '@/types';
import { db, newest, respond } from './db';
import { isActiveOrder, orderTotals, walletFor } from './lookups';
import { toOrderRow, type OrderRow } from './orders.service';

export type CustomerRow = Customer & {
  area: string;
  pincode: string;
  orders: number;
  activeOrders: number;
  /** Paid orders only. */
  totalSpent: number;
  walletBalance: number;
  lastOrderAt: string | null;
};

function toRow(c: Customer): CustomerRow {
  const mine = db.orders.filter((o) => o.customerId === c.id);
  const home = db.addresses.find((a) => a.customerId === c.id && a.isDefault) ?? db.addresses.find((a) => a.customerId === c.id);
  const last = [...mine].sort((a, b) => newest(a.placedAt, b.placedAt))[0];
  return {
    ...c,
    area: home?.line2 ?? '—',
    pincode: home?.pincode ?? '',
    orders: mine.length,
    activeOrders: mine.filter(isActiveOrder).length,
    totalSpent: mine.filter((o) => o.payment.status === 'paid').reduce((s, o) => s + orderTotals(o).total, 0),
    walletBalance: walletFor(c.id).balance,
    lastOrderAt: last?.placedAt ?? null,
  };
}

export function listCustomers(): Promise<CustomerRow[]> {
  return respond(db.customers.map(toRow).sort((a, b) => newest(a.customerSince, b.customerSince)), 'customers');
}

export type CustomerDetail = {
  customer: CustomerRow;
  addresses: CustomerAddress[];
  orders: OrderRow[];
  wallet: { balance: number; pending: number; entries: AdminWalletTxn[] };
  referrals: (AdminReferral & { friendLabel: string })[];
  referredByName: string | null;
  tickets: AdminTicket[];
};

export function getCustomer(id: string): Promise<CustomerDetail | null> {
  const c = db.customers.find((x) => x.id === id);
  if (!c) return respond(null, 'customers');
  const wallet = walletFor(id);
  return respond(
    {
      customer: toRow(c),
      addresses: db.addresses.filter((a) => a.customerId === id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
      orders: db.orders.filter((o) => o.customerId === id).sort((a, b) => newest(a.placedAt, b.placedAt)).map(toOrderRow),
      wallet: { ...wallet, entries: [...wallet.entries].sort((a, b) => newest(a.date, b.date)) },
      referrals: db.referrals.filter((r) => r.referrerId === id).map((r) => ({ ...r, friendLabel: r.friendName })),
      referredByName: c.referredBy ? (db.customers.find((x) => x.id === c.referredBy)?.fullName ?? null) : null,
      tickets: db.support.tickets.filter((t) => t.customerId === id),
    },
    'customers',
  );
}

export type CustomerPatch = Partial<Pick<Customer, 'fullName' | 'email' | 'phone' | 'note'>>;

/** SIMULATED: updates the in-memory sample data only. */
export function updateCustomer(id: string, patch: CustomerPatch): Promise<Customer> {
  const c = db.customers.find((x) => x.id === id);
  if (!c) return Promise.reject(new Error('Customer not found'));
  Object.assign(c, patch);
  return respond(c, '', 450);
}

/** SIMULATED: a paused customer can sign in but can't book new pickups (shown to the team as a rule, not enforced here). */
export function setCustomerStatus(id: string, status: CustomerStatus): Promise<Customer> {
  const c = db.customers.find((x) => x.id === id);
  if (!c) return Promise.reject(new Error('Customer not found'));
  c.status = status;
  return respond(c, '', 350);
}

