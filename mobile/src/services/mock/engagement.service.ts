/** Notifications, support and the dashboard content. */
import { getActiveCustomer } from '../../laundry/activeCustomer';
import { markNotificationsRead as markLaundryRead, notificationsFor } from '../../mock/services/notificationService';
import { mockStore } from '../../mock/store/mockStore';
import type { NotificationKind } from '../../mock/types';
import type { AppNotification, Dashboard, Faq, NotificationType, SupportInfo, SupportTicket } from '../../types/models';
import { db, newest, nextId, respond } from './db';

const LAUNDRY_TYPE: Partial<Record<NotificationKind, NotificationType>> = { READY: 'delivery', DELIVERED: 'delivery', VERIFY_CLOTHES: 'delivery', PAYMENT_COMPLETED: 'account', PAYMENT_FAILED: 'account', REFUND_ISSUED: 'account' };

/** The signed-in customer's laundry order updates (from the shared mock store), in the app's notification shape. */
function laundryNotifications(): AppNotification[] {
  const customerId = getActiveCustomer();
  const view = mockStore.getView();
  if (!customerId || !view.state) return [];
  return notificationsFor(view.state, 'customer', customerId).map((n) => ({
    id: n.id,
    type: LAUNDRY_TYPE[n.kind] ?? 'order',
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    read: !!n.readAt,
    laundryOrderId: n.orderId,
  }));
}

export function listNotifications(): Promise<AppNotification[]> {
  return respond([...db.notifications, ...laundryNotifications()].sort((a, b) => newest(a.createdAt, b.createdAt)));
}

/** SIMULATED: updates the in-memory mock (or, for order updates, the shared laundry mock store) only. */
export async function markNotificationRead(id: string): Promise<void> {
  if (id.startsWith('ln-')) return markLaundryRead([id]);
  const n = db.notifications.find((x) => x.id === id);
  if (n) n.read = true;
  return respond(undefined, 0);
}

/** SIMULATED: updates the in-memory mocks only. */
export async function markAllNotificationsRead(): Promise<void> {
  db.notifications.forEach((n) => (n.read = true));
  await markLaundryRead(laundryNotifications().filter((n) => !n.read).map((n) => n.id));
  return respond(undefined, 150);
}

export function getSupport(): Promise<SupportInfo> {
  return respond({ ...db.support, tickets: [...db.support.tickets].sort((a, b) => newest(a.createdAt, b.createdAt)) });
}

export function listFaqs(): Promise<Faq[]> {
  return respond(db.faq);
}

export type TicketInput = { subject: string; categoryId: string; message: string; orderId?: string };

/**
 * SIMULATED: saves the request in the in-memory mock so it appears under "Your requests".
 * It is not delivered to a support team; the UI says so.
 */
export function createTicket(input: TicketInput): Promise<SupportTicket> {
  const ticket: SupportTicket = {
    id: `T-${Number(nextId(db.support.tickets.map((t) => t.id), '')) || 3100}`,
    createdAt: new Date().toISOString(),
    status: 'open',
    subject: input.subject.trim(),
    categoryId: input.categoryId,
    message: input.message.trim(),
    orderId: input.orderId,
  };
  db.support.tickets.unshift(ticket);
  return respond(ticket, 500);
}

export function getDashboardContent(): Promise<Dashboard> {
  return respond(db.dashboard);
}
