/**
 * Order operations for customers. SIMULATED: each call waits a moment like a network request would, then applies
 * the operation to the shared mock store. Nothing is sent to a server.
 */
import * as ops from '../engine/ops.ts';
import type { IssueKind } from '../types.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';

export async function submitOrder(input: ops.SubmitInput) {
  await simulateLatency(700);
  return mockStore.transact((s, ctx) => ops.submitOrder(s, ctx, input));
}

export async function cancelOrder(orderId: string, customerId: string, reason: string) {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.cancelOrder(s, ctx, { orderId, customerId, reason }));
}

export async function confirmClothes(orderId: string, customerId: string, received: Record<string, number>) {
  await simulateLatency(600);
  return mockStore.transact((s, ctx) => ops.confirmClothes(s, ctx, { orderId, customerId, received }));
}

export async function reportIssue(input: { orderId: string; customerId: string; kind: IssueKind; received: Record<string, number>; note: string }) {
  await simulateLatency(600);
  return mockStore.transact((s, ctx) => ops.reportIssue(s, ctx, input));
}

export async function resolveIssue(issueId: string, resolution: string, adminName: string) {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.resolveIssue(s, ctx, { issueId, resolution, adminName }));
}

export async function ensureCustomer(input: { authKey: string; name: string; phone: string; email?: string; homeLocationId?: string }) {
  return mockStore.transact((s, ctx) => ops.ensureCustomer(s, ctx, input).id);
}
