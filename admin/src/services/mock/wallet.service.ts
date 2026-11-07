import type { AdminWalletTxn, WalletConfig } from '@/types';
import { db, newest, respond } from './db';
import { customerName, signed, walletFor } from './lookups';

export type TxnRow = AdminWalletTxn & { customerName: string };

export type WalletBalanceRow = {
  customerId: string;
  customerName: string;
  balance: number;
  pending: number;
  entries: number;
  lastEntryAt: string | null;
};

export type WalletOverview = {
  /** Money customers hold in their wallets right now (completed entries only). */
  totalBalance: number;
  /** Credits promised but not yet available, e.g. referral rewards waiting for a delivery. */
  pendingCredits: number;
  addedThisMonth: number;
  spentThisMonth: number;
  transactions: TxnRow[];
  balances: WalletBalanceRow[];
};

const inMonth = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export function getWalletOverview(): Promise<WalletOverview> {
  const done = db.wallet.filter((t) => t.status === 'completed');
  const balances: WalletBalanceRow[] = db.customers.map((c) => {
    const w = walletFor(c.id);
    const last = [...w.entries].sort((a, b) => newest(a.date, b.date))[0];
    return { customerId: c.id, customerName: c.fullName, balance: w.balance, pending: w.pending, entries: w.entries.length, lastEntryAt: last?.date ?? null };
  });
  return respond(
    {
      totalBalance: done.reduce((s, t) => s + signed(t), 0),
      pendingCredits: db.wallet.filter((t) => t.status === 'pending').reduce((s, t) => s + signed(t), 0),
      addedThisMonth: done.filter((t) => t.source === 'topup' && inMonth(t.date)).reduce((s, t) => s + t.amount, 0),
      spentThisMonth: done.filter((t) => t.type === 'debit' && inMonth(t.date)).reduce((s, t) => s + t.amount, 0),
      transactions: [...db.wallet].sort((a, b) => newest(a.date, b.date)).map((t) => ({ ...t, customerName: customerName(t.customerId) })),
      balances: balances.sort((a, b) => b.balance - a.balance),
    },
    'wallet',
  );
}

export function getWalletSettings(): Promise<WalletConfig> {
  return respond(db.walletSettings, 'wallet');
}

/** SIMULATED: changes the top-up rules the customer app's wallet uses, in the sample data only. */
export function updateWalletSettings(next: WalletConfig): Promise<WalletConfig> {
  db.walletSettings = { ...next, presets: [...next.presets].sort((a, b) => a - b) };
  return respond(db.walletSettings, '', 450);
}
