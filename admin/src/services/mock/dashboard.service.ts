/** The Overview page: worked out from the same sample data every other page uses, so the numbers always agree. */
import type { AdminProfile, OrderStatus } from '@/types';
import { db, newest, respond } from './db';
import { customerName, isActiveOrder, orderTotals, serviceName } from './lookups';
import { dayDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status';
import type { IconName } from '@/components/ui/Icon';

export type ActivityKind = 'order' | 'pickup' | 'signup' | 'wallet' | 'support';
export type Activity = { id: string; kind: ActivityKind; title: string; detail: string; at: string; link: string };
export type Attention = { id: string; tone: 'waiting' | 'stopped' | 'progress'; title: string; detail: string; link: string; action: string };

export type ActiveLeadOrder = {
  id: string;
  customerName: string;
  serviceName: string;
  status: OrderStatus;
  statusLabel: string;
  stageIndex: number;
  icon: IconName;
  isUrgent?: boolean;
};

export type Dashboard = {
  customers: { total: number; newLast30: number; activeLast30: number; paused: number };
  orders: { active: number; dueToday: number; overdue: number; placedLast30: number; placedPrev30: number };
  revenue: { last30: number; prev30: number };
  pendingRequests: number;
  openTickets: number;
  ordersByDay: { date: string; count: number; revenue: number }[];
  pipeline: { status: OrderStatus; count: number }[];
  topServices: { name: string; count: number }[];
  attention: Attention[];
  activity: Activity[];
  activeOrders: ActiveLeadOrder[];
};

const DAY = 86400_000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getDashboard(): Promise<Dashboard> {
  const now = Date.now();
  const today = dayKey(new Date());
  const within = (iso: string, from: number, to = now) => {
    const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return t >= from && t < to;
  };
  const last30 = now - 30 * DAY;
  const prev30 = now - 60 * DAY;

  const active = db.orders.filter(isActiveOrder);
  const paidTotal = (from: number, to?: number) =>
    db.orders.filter((o) => o.payment.status === 'paid' && within(o.placedAt, from, to)).reduce((s, o) => s + orderTotals(o).total, 0);

  const ordersByDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY);
    const key = dayKey(d);
    const placed = db.orders.filter((o) => dayKey(new Date(o.placedAt)) === key && o.status !== 'cancelled');
    return { date: key, count: placed.length, revenue: placed.reduce((s, o) => s + orderTotals(o).total, 0) };
  });

  const STAGES: OrderStatus[] = ['pickup_scheduled', 'collected', 'washing', 'drying', 'ironing', 'packing', 'out_for_delivery', 'delivered'];
  const sortedActive = [...active].sort((a, b) => {
    const isOverdueA = a.estimatedDelivery < today ? 1 : 0;
    const isOverdueB = b.estimatedDelivery < today ? 1 : 0;
    if (isOverdueA !== isOverdueB) return isOverdueB - isOverdueA;
    return STAGES.indexOf(b.status) - STAGES.indexOf(a.status);
  });
  const activeOrders: ActiveLeadOrder[] = sortedActive.slice(0, 4).map((o) => {
    const isOut = o.status === 'out_for_delivery';
    const isWash = o.status === 'washing' || o.status === 'drying';
    return {
      id: o.id,
      customerName: customerName(o.customerId),
      serviceName: serviceName(o.serviceId),
      status: o.status,
      statusLabel: ORDER_STATUS[o.status]?.label ?? o.status,
      stageIndex: Math.max(0, STAGES.indexOf(o.status)),
      icon: (isOut ? 'truck' : isWash ? 'droplet' : 'bag') as IconName,
      isUrgent: o.estimatedDelivery < today,
    };
  });

  const PIPE: OrderStatus[] = ['pickup_scheduled', 'collected', 'washing', 'drying', 'ironing', 'packing', 'out_for_delivery'];
  const services = new Map<string, number>();
  db.orders.filter((o) => within(o.placedAt, last30)).forEach((o) => services.set(o.serviceId, (services.get(o.serviceId) ?? 0) + 1));

  const overdue = active.filter((o) => o.estimatedDelivery < today);
  const pending = db.requests.filter((r) => r.status === 'pending');
  const open = db.support.tickets.filter((t) => t.status === 'open');
  const waitingRewards = db.wallet.filter((t) => t.status === 'pending');

  const attention: Attention[] = [
    ...pending.slice(0, 3).map((r) => ({
      id: r.id,
      tone: 'waiting' as const,
      title: `Confirm pickup ${r.id}`,
      detail: `${customerName(r.customerId)} · ${serviceName(r.serviceId)}`,
      link: `/pickups?status=pending&open=${r.id}`,
      action: 'Review',
    })),
    ...overdue.slice(0, 3).map((o) => ({
      id: o.id,
      tone: 'stopped' as const,
      title: `Order ${o.id} is past its delivery date`,
      detail: `${customerName(o.customerId)} · was due ${dayDate(o.estimatedDelivery)}`,
      link: `/orders?open=${o.id}`,
      action: 'Open order',
    })),
    ...open.slice(0, 2).map((t) => ({
      id: t.id,
      tone: 'progress' as const,
      title: `Reply to "${t.subject}"`,
      detail: `${customerName(t.customerId)} · help request ${t.id}`,
      link: `/support?open=${t.id}`,
      action: 'Reply',
    })),
  ];

  const activity: Activity[] = [
    ...db.orders.map((o) => ({
      id: `o-${o.id}`,
      kind: 'order' as const,
      title: o.status === 'delivered' && o.deliveredAt ? `Order ${o.id} delivered` : `New order ${o.id}`,
      detail: `${customerName(o.customerId)} · ${serviceName(o.serviceId)}`,
      at: o.status === 'delivered' && o.deliveredAt ? o.deliveredAt : o.placedAt,
      link: `/orders?open=${o.id}`,
    })),
    ...db.requests.filter((r) => r.status === 'pending').map((r) => ({
      id: `r-${r.id}`,
      kind: 'pickup' as const,
      title: `Pickup requested`,
      detail: `${customerName(r.customerId)} · ${serviceName(r.serviceId)}`,
      at: r.createdAt,
      link: `/pickups?open=${r.id}`,
    })),
    ...db.customers.map((c) => ({
      id: `c-${c.id}`,
      kind: 'signup' as const,
      title: 'New customer joined',
      detail: c.fullName,
      at: `${c.customerSince}T10:00:00+05:30`,
      link: `/customers?open=${c.id}`,
    })),
    ...db.wallet.filter((t) => t.source === 'topup').map((t) => ({
      id: `w-${t.id}`,
      kind: 'wallet' as const,
      title: 'Money added to wallet',
      detail: `${customerName(t.customerId)} · ₹${t.amount.toLocaleString('en-IN')}`,
      at: t.date,
      link: `/wallet?q=${encodeURIComponent(customerName(t.customerId))}`,
    })),
    ...db.support.tickets.map((t) => ({
      id: `t-${t.id}`,
      kind: 'support' as const,
      title: 'Help request received',
      detail: `${customerName(t.customerId)} · ${t.subject}`,
      at: t.createdAt,
      link: `/support?open=${t.id}`,
    })),
  ]
    .filter((a) => Date.parse(a.at) <= now)
    .sort((a, b) => newest(a.at, b.at))
    .slice(0, 8);

  const activeCustomers = new Set(db.orders.filter((o) => within(o.placedAt, last30)).map((o) => o.customerId));

  return respond(
    {
      customers: {
        total: db.customers.length,
        newLast30: db.customers.filter((c) => within(c.customerSince, last30)).length,
        activeLast30: activeCustomers.size,
        paused: db.customers.filter((c) => c.status === 'paused').length,
      },
      orders: {
        active: active.length,
        dueToday: active.filter((o) => o.estimatedDelivery === today).length,
        overdue: overdue.length,
        placedLast30: db.orders.filter((o) => within(o.placedAt, last30)).length,
        placedPrev30: db.orders.filter((o) => within(o.placedAt, prev30, last30)).length,
      },
      revenue: { last30: paidTotal(last30), prev30: paidTotal(prev30, last30) },
      pendingRequests: pending.length,
      openTickets: open.length,
      ordersByDay,
      pipeline: PIPE.map((status) => ({ status, count: active.filter((o) => o.status === status).length })),
      topServices: [...services.entries()].map(([id, count]) => ({ name: serviceName(id as never), count })).sort((a, b) => b.count - a.count),
      attention: [
        ...attention,
        ...(waitingRewards.length
          ? [
              {
                id: 'rewards',
                tone: 'progress' as const,
                title: `${waitingRewards.length} referral ${waitingRewards.length === 1 ? 'reward is' : 'rewards are'} waiting`,
                detail: 'They become spendable once the friend’s first order is delivered.',
                link: '/referrals',
                action: 'View',
              },
            ]
          : []),
      ],
      activity,
      activeOrders,
    },
    'dashboard',
  );
}

/** Small counts for the sidebar badges. */
export function getNavCounts(): Promise<{ pickups: number; support: number; orders: number }> {
  return respond(
    {
      pickups: db.requests.filter((r) => r.status === 'pending').length,
      support: db.support.tickets.filter((t) => t.status === 'open').length,
      orders: db.orders.filter(isActiveOrder).length,
    },
    '',
    120,
  );
}

export function getAdminProfile(): Promise<AdminProfile> {
  return respond(db.admin, '', 80);
}
