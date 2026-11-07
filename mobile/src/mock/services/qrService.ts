/** QR codes: refreshing a customer's code, and checking a code a staff member scanned. SIMULATED. */
import * as ops from '../engine/ops.ts';
import { verifyScan, type ScanIntent, type ScanOutcome } from '../engine/qr.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';

export { parseQrInput, qrPayload, shortCode } from '../engine/qr.ts';

export async function refreshQr(orderId: string, customerId: string, purpose: 'INTAKE' | 'DELIVERY') {
  await simulateLatency(500);
  return mockStore.transact((s, ctx) => ops.refreshQr(s, ctx, { orderId, customerId, purpose }));
}

/** Records the scan on the QR's history; never changes the order itself. Returns ids rather than live objects. */
export async function scan(raw: string, staffId: string, intent: ScanIntent, expectOrderId?: string) {
  await simulateLatency(550);
  return mockStore.transact((s, ctx): ScanResult => {
    const r: ScanOutcome = verifyScan(s, ctx, { raw, staffId, intent, expectOrderId });
    return r.ok ? { ok: true, qrId: r.qr.id, orderId: r.order.id, kind: r.kind } : { ok: false, code: r.code, reason: r.reason, orderId: r.orderId };
  });
}

export type ScanResult = { ok: true; qrId: string; orderId: string; kind: 'INTAKE' | 'DELIVERY' } | { ok: false; code: string; reason: string; orderId?: string };
