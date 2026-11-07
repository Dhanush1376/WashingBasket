/** Wallet reads and demo top-ups. SIMULATED: the wallet is mock data; top-ups never charge anything. */
import * as ops from '../engine/ops.ts';
import { walletBalance, walletPending } from '../engine/selectors.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';
import type { WalletTransaction } from '../types.ts';

export function getDemoTransactionsFor(customerId: string): WalletTransaction[] {
  return [
    {
      id: `wt-${customerId}-1`,
      customerId,
      type: 'credit',
      source: 'referral',
      amount: 200,
      title: 'Referral · Rahul M.',
      date: '2026-11-05T14:20:00.000Z',
      status: 'pending',
    },
    {
      id: `wt-${customerId}-2`,
      customerId,
      type: 'debit',
      source: 'order',
      amount: 112,
      title: 'Order #WB-1010',
      date: '2026-11-05T09:15:00.000Z',
      status: 'completed',
      orderId: 'WB-1010',
      idempotencyKey: `pay:WB-1010:${customerId}`,
    },
    {
      id: `wt-${customerId}-3`,
      customerId,
      type: 'credit',
      source: 'bonus',
      amount: 100,
      title: 'Top-up bonus',
      date: '2026-11-04T18:30:00.000Z',
      status: 'completed',
    },
    {
      id: `wt-${customerId}-4`,
      customerId,
      type: 'credit',
      source: 'topup',
      amount: 2000,
      title: 'Added via UPI',
      date: '2026-11-04T18:29:00.000Z',
      status: 'completed',
    },
    {
      id: `wt-${customerId}-5`,
      customerId,
      type: 'refund',
      source: 'refund',
      amount: 300,
      title: 'Refund · #WB-1006',
      date: '2026-11-04T10:38:00.000Z',
      status: 'completed',
      orderId: 'WB-1006',
      idempotencyKey: `reverse:WB-1006:${customerId}`,
    },
    {
      id: `wt-${customerId}-6`,
      customerId,
      type: 'debit',
      source: 'order',
      amount: 160,
      title: 'Order #WB-1005',
      date: '2026-11-03T16:45:00.000Z',
      status: 'completed',
      orderId: 'WB-1005',
      idempotencyKey: `pay:WB-1005:${customerId}`,
    },
    {
      id: `wt-${customerId}-7`,
      customerId,
      type: 'debit',
      source: 'order',
      amount: 128,
      title: 'Order #WB-1003',
      date: '2026-11-02T11:20:00.000Z',
      status: 'completed',
      orderId: 'WB-1003',
      idempotencyKey: `pay:WB-1003:${customerId}`,
    },
    {
      id: `wt-${customerId}-8`,
      customerId,
      type: 'debit',
      source: 'order',
      amount: 146,
      title: 'Order #WB-1002',
      date: '2026-11-01T15:10:00.000Z',
      status: 'completed',
      orderId: 'WB-1002',
      idempotencyKey: `pay:WB-1002:${customerId}`,
    },
    {
      id: `wt-${customerId}-9`,
      customerId,
      type: 'credit',
      source: 'topup',
      amount: 1000,
      title: 'Added via GPay',
      date: '2026-10-25T14:10:00.000Z',
      status: 'completed',
    },
    {
      id: `wt-${customerId}-10`,
      customerId,
      type: 'credit',
      source: 'referral',
      amount: 200,
      title: 'Referral · Ananya R.',
      date: '2026-10-18T10:30:00.000Z',
      status: 'completed',
    },
    {
      id: `wt-${customerId}-11`,
      customerId,
      type: 'refund',
      source: 'refund',
      amount: 49,
      title: 'Refund · #WB-1012',
      date: '2026-10-15T16:15:00.000Z',
      status: 'completed',
      orderId: 'WB-1012',
      idempotencyKey: `reverse:WB-1012:${customerId}`,
    },
    {
      id: `wt-${customerId}-12`,
      customerId,
      type: 'debit',
      source: 'order',
      amount: 275,
      title: 'Order #WB-1015',
      date: '2026-10-10T17:50:00.000Z',
      status: 'completed',
      orderId: 'WB-1015',
      idempotencyKey: `pay:WB-1015:${customerId}`,
    },
    {
      id: `wt-${customerId}-13`,
      customerId,
      type: 'credit',
      source: 'topup',
      amount: 500,
      title: 'Added via card',
      date: '2026-09-20T19:25:00.000Z',
      status: 'completed',
    },
    {
      id: `wt-${customerId}-14`,
      customerId,
      type: 'credit',
      source: 'bonus',
      amount: 100,
      title: 'Welcome bonus',
      date: '2026-09-12T10:05:00.000Z',
      status: 'completed',
    },
  ];
}

export async function getWallet(customerId: string) {
  await mockStore.ready();
  const s = mockStore.get();
  let existing = s.walletTransactions.filter((t) => t.customerId === customerId);

  // If the customer only has the initial welcome credit or fewer than 3 txns, enrich with realistic demo history
  if (existing.length <= 2) {
    const starterTxns = getDemoTransactionsFor(customerId);
    starterTxns.forEach((txn) => {
      if (!s.walletTransactions.some((x) => x.id === txn.id)) {
        s.walletTransactions.push(txn);
      }
    });
    existing = s.walletTransactions.filter((t) => t.customerId === customerId);
  }

  return {
    balance: walletBalance(s, customerId),
    pending: walletPending(s, customerId),
    transactions: existing.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
  };
}

export async function topUp(customerId: string, amount: number, bonus: number, bonusPercent: number) {
  await simulateLatency(400);
  return mockStore.transact((s, ctx) => ops.topUp(s, ctx, { customerId, amount, bonus, bonusPercent }));
}
