/**
 * QR tokens. Each one belongs to one order, one location and one purpose, is single-use, and expires.
 *
 * The QR image encodes only "WBQR:1:<purpose code>:<token>" — a random reference — never customer details.
 * MOCK ONLY: the token is random but there is no cryptographic signing; a real backend must sign and verify.
 */
import type { LaundryOrder, MockState, OpContext, QrPurpose, QrToken } from '../types.ts';
import { intakePurpose, QR_PURPOSE_COPY } from './lifecycle.ts';
import { actorForStaff, logActivity } from './records.ts';
import { findOrder, findStaff, qrState } from './selectors.ts';
import { addMinutes, fail, nextNumber, randomToken } from './util.ts';

export const QR_PREFIX = 'WBQR:1';

/** How long each kind of QR stays valid once it is usable. */
export const QR_TTL_MINUTES: Record<QrPurpose, number> = {
  ORDER_SUBMISSION: 24 * 60,
  PICKUP_COLLECTION: 3 * 24 * 60,
  CUSTOMER_DELIVERY_VERIFICATION: 30,
};

export const qrPayload = (q: Pick<QrToken, 'purpose' | 'token'>) => `${QR_PREFIX}:${QR_PURPOSE_COPY[q.purpose].code}:${q.token}`;

/** "7KQ2M-9XD4P": what staff can type in if a camera can't read the code. */
export const shortCode = (token: string) => `${token.slice(0, 5)}-${token.slice(5)}`;

/** Accepts the full payload or the short code, in any case and spacing. */
export function parseQrInput(raw: string): { token: string; purposeCode?: string } | null {
  const text = raw.trim().toUpperCase();
  const full = /^WBQR:1:(SUB|PCK|DLV):([A-Z0-9]{10})$/.exec(text);
  if (full) return { purposeCode: full[1], token: full[2] };
  const short = text.replace(/[\s-]/g, '');
  if (/^[A-Z0-9]{10}$/.test(short)) return { token: short };
  return null;
}

export function issueQr(s: MockState, ctx: OpContext, order: LaundryOrder, purpose: QrPurpose, active: boolean): QrToken {
  const ttl = QR_TTL_MINUTES[purpose];
  const qr: QrToken = {
    id: `qr-${nextNumber(s, 'qr')}`,
    token: randomToken(10),
    orderId: order.id,
    locationId: order.locationId,
    purpose,
    status: active ? 'ACTIVE' : 'LOCKED',
    createdAt: ctx.now,
    ttlMinutes: ttl,
    ...(active ? { activatedAt: ctx.now, expiresAt: addMinutes(ctx.now, ttl) } : {}),
    scans: [],
  };
  s.qrTokens.unshift(qr);
  return qr;
}

export function activateQr(qr: QrToken, ctx: OpContext) {
  qr.status = 'ACTIVE';
  qr.activatedAt = ctx.now;
  qr.expiresAt = addMinutes(ctx.now, qr.ttlMinutes);
}

export function revokeQr(qr: QrToken | undefined, ctx: OpContext, reason: string) {
  if (!qr || qr.status === 'CONSUMED' || qr.status === 'REVOKED') return;
  qr.status = 'REVOKED';
  qr.revokedAt = ctx.now;
  qr.revokeReason = reason;
}

export type ScanIntent = 'ANY' | 'INTAKE' | 'DELIVERY';

export type ScanOutcome =
  | { ok: true; qr: QrToken; order: LaundryOrder; kind: 'INTAKE' | 'DELIVERY' }
  | { ok: false; code: string; reason: string; qrId?: string; orderId?: string };

/**
 * Checks a scanned code for a staff member and records the attempt on the QR (its verification history).
 * It never changes the order: accepting, rejecting or delivering are separate steps that check everything again.
 */
export function verifyScan(s: MockState, ctx: OpContext, input: { raw: string; staffId: string; intent: ScanIntent; expectOrderId?: string }): ScanOutcome {
  const staff = findStaff(s, input.staffId);
  if (!staff || staff.status !== 'ACTIVE') return { ok: false, code: 'STAFF_INACTIVE', reason: 'This staff account isn’t active.' };

  const parsed = parseQrInput(input.raw);
  if (!parsed) return { ok: false, code: 'NOT_WB_QR', reason: 'This isn’t a Washing Basket QR code.' };
  const qr = s.qrTokens.find((q) => q.token === parsed.token);
  if (!qr || (parsed.purposeCode && QR_PURPOSE_COPY[qr.purpose].code !== parsed.purposeCode)) {
    return { ok: false, code: 'UNKNOWN_QR', reason: 'We don’t recognise this code. Ask the customer to refresh it in their app.' };
  }
  const order = findOrder(s, qr.orderId);
  const refuse = (code: string, reason: string): ScanOutcome => {
    qr.scans.push({ at: ctx.now, staffId: staff.id, result: 'REFUSED', reason });
    if (order) logActivity(s, ctx, order, 'QR_REFUSED', actorForStaff(s, staff.id), `${QR_PURPOSE_COPY[qr.purpose].label} QR refused: ${reason}`);
    return { ok: false, code, reason, qrId: qr.id, orderId: qr.orderId };
  };
  if (!order) return refuse('UNKNOWN_ORDER', 'This code isn’t linked to an order.');

  // location isolation: LPU staff never process NIT orders, and so on
  if (qr.locationId !== staff.locationId) {
    const where = s.locations.find((l) => l.id === qr.locationId)?.shortName ?? 'another location';
    return refuse('WRONG_LOCATION', `This order belongs to ${where}. You can only process orders for your own location.`);
  }
  if (input.expectOrderId && input.expectOrderId !== order.id) return refuse('WRONG_ORDER', `This QR is for order ${order.id}, not ${input.expectOrderId}.`);

  const isDelivery = qr.purpose === 'CUSTOMER_DELIVERY_VERIFICATION';
  if (input.intent === 'INTAKE' && isDelivery) return refuse('WRONG_PURPOSE', 'This is a delivery QR. It can’t be used to accept an order.');
  if (input.intent === 'DELIVERY' && !isDelivery) return refuse('WRONG_PURPOSE', 'This is a submission QR. Ask the customer for their delivery QR.');

  const state = qrState(qr, ctx.now);
  if (state === 'LOCKED') return refuse('QR_LOCKED', 'Payment isn’t complete, so this QR is still locked.');
  if (state === 'CONSUMED') return refuse('QR_USED', `This QR was already used${qr.consumedAt ? ` on ${new Date(qr.consumedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}. Codes work once.`);
  if (state === 'REVOKED') return refuse('QR_REVOKED', 'This QR was replaced or cancelled. Ask the customer to show the latest one.');
  if (state === 'EXPIRED') return refuse('QR_EXPIRED', 'This QR has expired. Ask the customer to refresh it in their app.');

  if (!isDelivery) {
    if (qr.purpose !== intakePurpose(order.serviceMode)) return refuse('WRONG_PURPOSE', 'This QR doesn’t match the order’s service type.');
    if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') return refuse('BAD_STATE', `Order ${order.id} isn’t waiting for acceptance.`);
    if (order.payment.status !== 'COMPLETED') return refuse('NOT_PAID', `Order ${order.id} hasn’t been paid.`);
  } else {
    if (order.status !== 'AWAITING_CUSTOMER_VERIFICATION' || !order.verification) return refuse('NOT_VERIFIED', 'The customer hasn’t confirmed their clothes yet.');
  }

  qr.scans.push({ at: ctx.now, staffId: staff.id, result: 'VALID', reason: 'Scanned and checked' });
  logActivity(s, ctx, order, 'QR_SCANNED', actorForStaff(s, staff.id), `${QR_PURPOSE_COPY[qr.purpose].label} QR scanned`);
  return { ok: true, qr, order, kind: isDelivery ? 'DELIVERY' : 'INTAKE' };
}

/** Re-checks a QR at the moment it is used, then marks it used so it can never work again. */
export function consumeQr(s: MockState, ctx: OpContext, qrId: string, expect: { orderId: string; purpose: QrPurpose; staffId: string }): QrToken {
  const qr = s.qrTokens.find((q) => q.id === qrId);
  if (!qr || qr.orderId !== expect.orderId) return fail('QR_MISMATCH', 'This QR doesn’t belong to this order.');
  if (qr.purpose !== expect.purpose) return fail('WRONG_PURPOSE', `This is a ${QR_PURPOSE_COPY[qr.purpose].label.toLowerCase()} QR, not a ${QR_PURPOSE_COPY[expect.purpose].label.toLowerCase()} QR.`);
  const state = qrState(qr, ctx.now);
  if (state === 'CONSUMED') return fail('QR_USED', 'This QR was already used.');
  if (state === 'LOCKED') return fail('QR_LOCKED', 'This QR is still locked.');
  if (state === 'REVOKED') return fail('QR_REVOKED', 'This QR was replaced or cancelled.');
  if (state === 'EXPIRED') return fail('QR_EXPIRED', 'This QR has expired.');
  qr.status = 'CONSUMED';
  qr.consumedAt = ctx.now;
  qr.consumedBy = expect.staffId;
  qr.scans.push({ at: ctx.now, staffId: expect.staffId, result: 'CONSUMED', reason: 'Used to complete the step' });
  const order = findOrder(s, qr.orderId);
  if (order) logActivity(s, ctx, order, 'QR_CONSUMED', actorForStaff(s, expect.staffId), `${QR_PURPOSE_COPY[qr.purpose].label} QR used and closed`);
  return qr;
}
