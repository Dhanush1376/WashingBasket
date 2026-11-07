/** Mock notifications: written by the engine at each step, read by the customer, staff and admin screens. */
import * as ops from '../engine/ops.ts';
import { mockStore } from '../store/mockStore.ts';
import type { LaundryNotification, MockState } from '../types.ts';

export const notificationsFor = (s: MockState, audience: LaundryNotification['audience'], recipientId: string) =>
  s.notifications.filter((n) => n.audience === audience && n.recipientId === recipientId);

/** SIMULATED: marks them read in the shared mock store. */
export function markNotificationsRead(ids: string[]) {
  if (!ids.length) return Promise.resolve();
  return mockStore.transact((s, ctx) => ops.markNotificationsRead(s, ctx, { ids }));
}
