/** Recording helpers: every status change, payment and scan leaves an activity; people get notifications. */
import type { ActivityType, Actor, LaundryNotification, LaundryOrder, MockState, NotificationKind, OpContext, OrderStatus } from '../types.ts';
import { canTransition, STATUS_COPY } from './lifecycle.ts';
import { fail, nextNumber } from './util.ts';

export function logActivity(
  s: MockState,
  ctx: OpContext,
  order: LaundryOrder,
  type: ActivityType,
  actor: Actor,
  message: string,
  extra?: { from?: OrderStatus; to?: OrderStatus },
) {
  s.activities.unshift({
    id: `act-${nextNumber(s, 'activity')}`,
    orderId: order.id,
    at: ctx.now,
    type,
    actor,
    message,
    locationId: order.locationId,
    ...extra,
  });
}

/** Moves an order one step, if the state machine allows it from where it is, and records it. */
export function transition(s: MockState, ctx: OpContext, order: LaundryOrder, to: OrderStatus, actor: Actor, message?: string) {
  if (!canTransition(order, to)) {
    fail('INVALID_TRANSITION', `Order ${order.id} can’t move from “${STATUS_COPY[order.status].label}” to “${STATUS_COPY[to].label}”.`);
  }
  const from = order.status;
  order.status = to;
  order.updatedAt = ctx.now;
  logActivity(s, ctx, order, 'STATUS_CHANGED', actor, message ?? STATUS_COPY[to].label, { from, to });
}

export function notify(
  s: MockState,
  ctx: OpContext,
  audience: LaundryNotification['audience'],
  recipientId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  orderId?: string,
) {
  s.notifications.unshift({ id: `ln-${nextNumber(s, 'notification')}`, audience, recipientId, kind, title, body, orderId, createdAt: ctx.now });
}

export function actorForStaff(s: MockState, staffId: string): Actor {
  const st = s.staff.find((x) => x.id === staffId);
  return { kind: 'staff', id: staffId, name: st?.name ?? staffId };
}

export function actorForCustomer(s: MockState, customerId: string): Actor {
  const c = s.customers.find((x) => x.id === customerId);
  return { kind: 'customer', id: customerId, name: c?.name ?? 'Customer' };
}
