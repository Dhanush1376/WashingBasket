/** Staff work: accept, reject, process, hand over and deliver. SIMULATED operations on the shared mock store. */
import * as ops from '../engine/ops.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';

export async function signIn(phone: string, pincode: string) {
  await simulateLatency(500);
  await mockStore.ready();
  return ops.staffSignIn(mockStore.get(), { phone, pincode });
}

export async function acceptOrder(orderId: string, staffId: string, qrId: string) {
  await simulateLatency(800);
  return mockStore.transact((s, ctx) => ops.acceptOrder(s, ctx, { orderId, staffId, qrId }).id);
}

export async function rejectOrder(orderId: string, staffId: string, qrId: string, reason: string) {
  await simulateLatency(800);
  return mockStore.transact((s, ctx) => ops.rejectOrder(s, ctx, { orderId, staffId, qrId, reason }).id);
}

export async function startProcessing(orderId: string, staffId: string) {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.startProcessing(s, ctx, { orderId, staffId }).id);
}

export async function markReady(orderId: string, staffId: string) {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.markReady(s, ctx, { orderId, staffId }).id);
}

export async function handOver(orderId: string, staffId: string) {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.handOver(s, ctx, { orderId, staffId }).id);
}

export async function confirmDelivery(orderId: string, staffId: string, qrId: string) {
  await simulateLatency(800);
  return mockStore.transact((s, ctx) => ops.confirmDelivery(s, ctx, { orderId, staffId, qrId }).id);
}

export async function setStaffStatus(staffId: string, status: 'ACTIVE' | 'SUSPENDED') {
  await simulateLatency(400);
  return mockStore.transact((s) => ops.setStaffStatus(s, { staffId, status }).id);
}
