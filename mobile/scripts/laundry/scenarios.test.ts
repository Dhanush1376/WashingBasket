/**
 * End-to-end business scenarios for the laundry order engine, run against the real seed data.
 *
 *   node --test scripts/laundry/scenarios.test.ts      (or: npm run laundry:test)
 *
 * Each test drives the same operations the customer, staff and admin screens call.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import * as ops from '../../src/mock/engine/ops.ts';
import { verifyScan, qrPayload } from '../../src/mock/engine/qr.ts';
import { buildState } from '../../src/mock/engine/seed.ts';
import { findOrder, findQr, walletBalance, statusTimes } from '../../src/mock/engine/selectors.ts';
import { MockError } from '../../src/mock/engine/util.ts';
import type { MockState, OpContext } from '../../src/mock/types.ts';
import { allFiles } from './load.ts';

let s: MockState;
let clock = Date.parse('2026-11-05T10:00:00+05:30');
const ctx = (): OpContext => {
  clock += 60_000;
  return { now: new Date(clock).toISOString() };
};
const today = () => new Date(clock).toISOString().slice(0, 10);

const LPU = 'st-lpu-01';
const NIT = 'st-nit-01';
const OUT = 'st-out-01';

function newCustomer(name = 'Test Customer', key = '9000000001') {
  return ops.ensureCustomer(s, ctx(), { authKey: key, name, phone: key }).id;
}

function rejects(fn: () => unknown, code: string) {
  assert.throws(fn, (e: unknown) => e instanceof MockError && e.code === code, `expected ${code}`);
}

const payload = (qrId: string | undefined) => qrPayload(findQr(s, qrId)!);
/** Sorting → washing → drying → ironing → quality check, as the wash floor does it. */
function washThrough(orderId: string, staffId: string) {
  for (const to of ['WASHING', 'DRYING', 'IRONING', 'QUALITY_CHECK'] as const) ops.advanceStage(s, ctx(), { orderId, staffId, to });
}
const all = (orderId: string) => Object.fromEntries(findOrder(s, orderId)!.lines.map((l) => [l.itemId, l.qty]));

beforeEach(() => {
  s = buildState(allFiles(), new Date(clock).toISOString());
});

describe('seed data', () => {
  it('is internally consistent', () => {
    for (const o of s.orders) {
      assert.ok(s.customers.some((c) => c.id === o.customerId), `${o.id} customer`);
      assert.ok(s.locations.some((l) => l.id === o.locationId), `${o.id} location`);
      assert.ok(findQr(s, o.intakeQrId), `${o.id} intake QR`);
      const paid = s.walletTransactions.filter((t) => t.idempotencyKey === `pay:${o.id}`);
      assert.ok(paid.length <= 1, `${o.id} paid at most once`);
      if (o.payment.status === 'COMPLETED' || o.payment.status === 'REVERSED') assert.equal(paid.length, 1);
      if (o.receiptId) assert.ok(['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED'].includes(o.status));
    }
    assert.equal(s.locations.find((l) => l.id === 'loc-lpu')!.pincode, '144411');
    assert.equal(s.locations.find((l) => l.id === 'loc-nit')!.pincode, '144011');
    assert.equal(s.locations.find((l) => l.id === 'loc-outside')!.pincode, '144003');
  });

  it('takes printed-list prices from price-menu.json', () => {
    const item = s.catalog.categories.flatMap((c) => c.items).find((i) => i.id === 'bl-dry-double')!;
    assert.equal(item.price, 600);
    assert.equal(item.priceSource, 'printed-list');
  });
});

describe('Scenario 1 — LPU office order, end to end', () => {
  it('goes from basket to DELIVERED with one debit and a receipt', () => {
    const cust = newCustomer();
    const start = walletBalance(s, cust);
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 3 }, { itemId: 'ow-ezee', qty: 2 }] });
    assert.equal(o.status, 'PAYMENT_PENDING');
    assert.equal(o.pieces, 5);
    assert.equal(o.total, 3 * 45 + 2 * 55);
    assert.equal(findQr(s, o.intakeQrId)!.status, 'LOCKED');
    assert.equal(findQr(s, o.intakeQrId)!.purpose, 'ORDER_SUBMISSION');

    // a locked QR can't be accepted
    const locked = verifyScan(s, ctx(), { raw: payload(o.intakeQrId), staffId: LPU, intent: 'ANY' });
    assert.equal(locked.ok, false);

    const pay = ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    assert.equal(pay.ok, true);
    assert.equal(walletBalance(s, cust), start - o.total);
    assert.equal(findOrder(s, o.id)!.status, 'AWAITING_STAFF_ACCEPTANCE');
    assert.equal(findQr(s, o.intakeQrId)!.status, 'ACTIVE');

    const scanned = verifyScan(s, ctx(), { raw: payload(o.intakeQrId), staffId: LPU, intent: 'ANY' });
    assert.ok(scanned.ok && scanned.kind === 'INTAKE');
    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId });
    const accepted = findOrder(s, o.id)!;
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.acceptedBy, LPU);
    assert.ok(accepted.receiptId && s.receipts.some((r) => r.orderId === o.id));
    assert.ok(s.notifications.some((n) => n.recipientId === cust && n.kind === 'ORDER_ACCEPTED'));
    assert.equal(walletBalance(s, cust), start - o.total, 'acceptance never debits again');

    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: LPU });
    washThrough(o.id, LPU);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: LPU });
    assert.equal(findOrder(s, o.id)!.status, 'READY_FOR_DELIVERY');

    ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) });
    const verified = findOrder(s, o.id)!;
    assert.equal(verified.status, 'AWAITING_CUSTOMER_VERIFICATION');
    const dq = findQr(s, verified.deliveryQrId)!;
    assert.equal(dq.purpose, 'CUSTOMER_DELIVERY_VERIFICATION');
    assert.notEqual(dq.token, findQr(s, o.intakeQrId)!.token);

    const dscan = verifyScan(s, ctx(), { raw: qrPayload(dq), staffId: LPU, intent: 'DELIVERY' });
    assert.ok(dscan.ok && dscan.kind === 'DELIVERY');
    ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: LPU, qrId: dq.id });
    const done = findOrder(s, o.id)!;
    assert.equal(done.status, 'DELIVERED');
    assert.equal(done.deliveredBy, LPU);
    assert.equal(findQr(s, dq.id)!.status, 'CONSUMED');
    // the timeline has every office step and no pickup step
    const times = statusTimes(s, o.id);
    for (const st of ['REQUEST_SUBMITTED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'AWAITING_STAFF_ACCEPTANCE', 'ACCEPTED', 'PROCESSING', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED']) assert.ok(times[st], st);
    assert.equal(times.PICKUP_CONFIRMED, undefined);
    // delivering twice is refused
    rejects(() => ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: LPU, qrId: dq.id }), 'ALREADY_DELIVERED');
  });
});

describe('Scenario 2 — NIT office order and location isolation', () => {
  it('NIT staff complete NIT orders; LPU staff can’t touch them (and vice versa)', () => {
    const cust = newCustomer();
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'wi-normal', qty: 2 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });

    const wrong = verifyScan(s, ctx(), { raw: payload(o.intakeQrId), staffId: LPU, intent: 'ANY' });
    assert.ok(!wrong.ok && wrong.code === 'WRONG_LOCATION');
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId }), 'WRONG_LOCATION');
    assert.equal(findOrder(s, o.id)!.status, 'AWAITING_STAFF_ACCEPTANCE');

    // the seeded LPU order WB-1010 is off limits to NIT staff
    const lpuOrder = findOrder(s, 'WB-1010')!;
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: lpuOrder.id, staffId: NIT, qrId: lpuOrder.intakeQrId }), 'WRONG_LOCATION');

    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: NIT, qrId: o.intakeQrId });
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: NIT });
    rejects(() => ops.markReady(s, ctx(), { orderId: o.id, staffId: LPU }), 'WRONG_LOCATION');
    washThrough(o.id, NIT);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: NIT });
    ops.handOver(s, ctx(), { orderId: o.id, staffId: NIT });
    ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) });
    ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: NIT, qrId: findOrder(s, o.id)!.deliveryQrId! });
    assert.equal(findOrder(s, o.id)!.status, 'DELIVERED');
  });
});

describe('Scenario 3 — Outside Campus home pickup', () => {
  it('collects at the door, adds the pickup charge, and delivers back', () => {
    const cust = newCustomer();
    const start = walletBalance(s, cust);
    const o = ops.submitOrder(s, ctx(), {
      customerId: cust,
      locationId: 'loc-outside',
      serviceMode: 'HOME_PICKUP',
      basket: [{ itemId: 'ow-normal', qty: 4 }, { itemId: 'ow-whites', qty: 2 }],
      pickup: { address: '12 Rose Lane, Model Town, Jalandhar', contactPhone: '9000000001', date: today(), slotId: 'hp-evening' },
    });
    assert.equal(o.serviceCharge, 49);
    assert.equal(o.total, 4 * 45 + 2 * 60 + 49);
    assert.equal(findQr(s, o.intakeQrId)!.purpose, 'PICKUP_COLLECTION');
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    assert.equal(walletBalance(s, cust), start - o.total);

    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: OUT, qrId: o.intakeQrId });
    assert.equal(findOrder(s, o.id)!.status, 'PICKUP_CONFIRMED');
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: OUT });
    washThrough(o.id, OUT);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: OUT });
    ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) });
    ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: OUT, qrId: findOrder(s, o.id)!.deliveryQrId! });
    assert.equal(findOrder(s, o.id)!.status, 'DELIVERED');
    assert.ok(statusTimes(s, o.id).PICKUP_CONFIRMED);
  });

  it('refuses home pickup at a campus office, and incomplete pickup details', () => {
    const cust = newCustomer();
    rejects(() => ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'HOME_PICKUP', basket: [{ itemId: 'ow-normal', qty: 1 }] }), 'MODE_UNAVAILABLE');
    rejects(
      () => ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-outside', serviceMode: 'HOME_PICKUP', basket: [{ itemId: 'ow-normal', qty: 1 }], pickup: { address: 'x', contactPhone: '9000000001', date: today(), slotId: 'hp-noon' } }),
      'BAD_ADDRESS',
    );
  });
});

describe('Scenario 4 — rejected order', () => {
  it('reverses the payment exactly once and leaves no receipt', () => {
    const cust = newCustomer();
    const start = walletBalance(s, cust);
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'dc-premium', qty: 2 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    assert.equal(walletBalance(s, cust), start - o.total);
    rejects(() => ops.rejectOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId, reason: '' }), 'NO_REASON');
    ops.rejectOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId, reason: 'Fabric is torn' });
    const r = findOrder(s, o.id)!;
    assert.equal(r.status, 'REJECTED');
    assert.equal(r.payment.status, 'REVERSED');
    assert.equal(r.rejectionReason, 'Fabric is torn');
    assert.equal(walletBalance(s, cust), start);
    assert.equal(s.walletTransactions.filter((t) => t.idempotencyKey === `reverse:${o.id}`).length, 1);
    assert.ok(!s.receipts.some((x) => x.orderId === o.id));
    assert.ok(s.notifications.some((n) => n.recipientId === cust && n.kind === 'ORDER_REJECTED'));
    rejects(() => ops.rejectOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId, reason: 'again' }), 'BAD_STATE');
  });
});

describe('Scenario 5 — insufficient wallet balance', () => {
  it('records a failed payment, debits nothing and keeps the QR locked', () => {
    const cust = newCustomer();
    const start = walletBalance(s, cust);
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'bl-dry-double', qty: 3 }] });
    assert.ok(o.total > start);
    const r = ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.shortfall, o.total - start);
    assert.equal(walletBalance(s, cust), start);
    assert.equal(findOrder(s, o.id)!.payment.status, 'FAILED');
    assert.equal(findOrder(s, o.id)!.status, 'PAYMENT_PENDING');
    assert.equal(findQr(s, o.intakeQrId)!.status, 'LOCKED');
    // top up, then the same order pays fine — once
    ops.topUp(s, ctx(), { customerId: cust, amount: 1000, bonus: 0, bonusPercent: 0 });
    assert.equal(ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust }).ok, true);
    rejects(() => ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust }), 'ALREADY_PAID');
    assert.equal(s.walletTransactions.filter((t) => t.idempotencyKey === `pay:${o.id}`).length, 1);
  });
});

describe('Scenario 6 — delivery discrepancy', () => {
  it('blocks the delivery QR and delivery until the issue is resolved', () => {
    const cust = newCustomer();
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 3 }, { itemId: 'ow-whites', qty: 1 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId });
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: LPU });
    washThrough(o.id, LPU);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: LPU });

    const short = { ...all(o.id), 'ow-normal': 2 };
    rejects(() => ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: short }), 'COUNT_MISMATCH');
    const issue = ops.reportIssue(s, ctx(), { orderId: o.id, customerId: cust, kind: 'MISSING_ITEMS', received: short, note: '' });
    assert.deepEqual(issue.mismatches.map((m) => [m.itemId, m.expected, m.received]), [['ow-normal', 3, 2]]);
    const after = findOrder(s, o.id)!;
    assert.equal(after.deliveryQrId, undefined, 'no delivery QR');
    assert.notEqual(after.status, 'DELIVERED');
    rejects(() => ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) }), 'ISSUE_OPEN');
    assert.ok(s.notifications.some((n) => n.audience === 'admin' && n.orderId === o.id));

    ops.resolveIssue(s, ctx(), { issueId: issue.id, resolution: 'Missing shirt found and returned', adminName: 'Admin' });
    ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) });
    ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: LPU, qrId: findOrder(s, o.id)!.deliveryQrId! });
    assert.equal(findOrder(s, o.id)!.status, 'DELIVERED');
  });

  it('can’t deliver without the customer’s verification', () => {
    const o = findOrder(s, 'WB-1004')!; // seeded: ready, not verified
    rejects(() => ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: OUT, qrId: o.intakeQrId }), 'NOT_VERIFIED');
  });
});

describe('Scenario 7 — QR reuse and purpose mix-ups', () => {
  it('refuses a used submission QR and a used delivery QR, leaving orders unchanged', () => {
    const cust = newCustomer();
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 1 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    const sub = payload(o.intakeQrId);
    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId });

    const before = JSON.stringify(findOrder(s, o.id));
    const again = verifyScan(s, ctx(), { raw: sub, staffId: LPU, intent: 'ANY' });
    assert.ok(!again.ok && again.code === 'QR_USED');
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId }), 'BAD_STATE');
    assert.equal(JSON.stringify(findOrder(s, o.id)), before);

    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: LPU });
    washThrough(o.id, LPU);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: LPU });
    // a submission QR can't complete a delivery
    const asDelivery = verifyScan(s, ctx(), { raw: sub, staffId: LPU, intent: 'DELIVERY' });
    assert.ok(!asDelivery.ok && asDelivery.code === 'WRONG_PURPOSE');

    ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) });
    const dq = findQr(s, findOrder(s, o.id)!.deliveryQrId)!;
    // a delivery QR can't be used to accept (create) an order
    const asIntake = verifyScan(s, ctx(), { raw: qrPayload(dq), staffId: LPU, intent: 'INTAKE' });
    assert.ok(!asIntake.ok && asIntake.code === 'WRONG_PURPOSE');
    ops.confirmDelivery(s, ctx(), { orderId: o.id, staffId: LPU, qrId: dq.id });

    const delivered = JSON.stringify(findOrder(s, o.id));
    const reuse = verifyScan(s, ctx(), { raw: qrPayload(dq), staffId: LPU, intent: 'DELIVERY' });
    assert.ok(!reuse.ok && reuse.code === 'QR_USED');
    assert.equal(JSON.stringify(findOrder(s, o.id)), delivered);
    assert.ok(findQr(s, dq.id)!.scans.some((x) => x.result === 'REFUSED'), 'refused scans are in the QR history');
  });

  it('refuses an expired QR and a refreshed (replaced) QR', () => {
    const cust = newCustomer();
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 1 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    const old = payload(o.intakeQrId);
    ops.refreshQr(s, ctx(), { orderId: o.id, customerId: cust, purpose: 'INTAKE' });
    const replaced = verifyScan(s, ctx(), { raw: old, staffId: LPU, intent: 'ANY' });
    assert.ok(!replaced.ok && replaced.code === 'QR_REVOKED');
    clock += 25 * 60 * 60_000;
    const expired = verifyScan(s, ctx(), { raw: payload(findOrder(s, o.id)!.intakeQrId), staffId: LPU, intent: 'ANY' });
    assert.ok(!expired.ok && expired.code === 'QR_EXPIRED');
  });
});

describe('Other rules', () => {
  it('a suspended staff member can’t sign in or act', () => {
    ops.setStaffStatus(s, { staffId: LPU, status: 'SUSPENDED' });
    rejects(() => ops.staffSignIn(s, { phone: '9876543210', pincode: '144411' }), 'SUSPENDED');
    const o = findOrder(s, 'WB-1010')!;
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId }), 'SUSPENDED');
  });

  it('staff sign-in maps the PIN code to the right location', () => {
    assert.equal(ops.staffSignIn(s, { phone: '+91 98765 43210', pincode: '144411' }).locationId, 'loc-lpu');
    assert.equal(ops.staffSignIn(s, { phone: '9876543210', pincode: '144011' }).locationId, 'loc-nit');
    assert.equal(ops.staffSignIn(s, { phone: '9876543210', pincode: '144003' }).locationId, 'loc-outside');
    rejects(() => ops.staffSignIn(s, { phone: '9876543210', pincode: '111111' }), 'NO_LOCATION');
    rejects(() => ops.staffSignIn(s, { phone: '9000012345', pincode: '144411' }), 'NO_STAFF');
  });

  it('an order can’t skip stages', () => {
    const o = findOrder(s, 'WB-1010')!; // awaiting acceptance
    rejects(() => ops.startProcessing(s, ctx(), { orderId: o.id, staffId: LPU }), 'INVALID_TRANSITION');
    rejects(() => ops.markReady(s, ctx(), { orderId: o.id, staffId: LPU }), 'INVALID_TRANSITION');
    const home = findOrder(s, 'WB-1007')!;
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: home.id, staffId: OUT, qrId: 'qr-nope' }), 'QR_MISMATCH');
  });

  it('a paused location takes no new orders', () => {
    ops.setLocationStatus(s, { locationId: 'loc-nit', status: 'PAUSED' });
    const cust = newCustomer();
    rejects(() => ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 1 }] }), 'LOCATION_PAUSED');
  });

  it('the same sign-in reuses one customer and one wallet', () => {
    const a = newCustomer('A', '9111111111');
    const b = newCustomer('A again', '9111111111');
    assert.equal(a, b);
    assert.equal(s.walletAccounts.filter((w) => w.customerId === a).length, 1);
    assert.equal(walletBalance(s, a), ops.WELCOME_CREDIT);
  });
});

describe('Staff roles and the wash floor', () => {
  const PROC = 'st-lpu-04';
  const BOSS = 'st-lpu-03';

  function acceptedLpuOrder() {
    const cust = newCustomer('Stage Tester', '9000000777');
    const o = ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 2 }] });
    ops.payOrder(s, ctx(), { orderId: o.id, customerId: cust });
    ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: LPU, qrId: o.intakeQrId });
    return { o: findOrder(s, o.id)!, cust };
  }

  it('processing goes through every stage in order, once', () => {
    const { o } = acceptedLpuOrder();
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: PROC });
    assert.equal(findOrder(s, o.id)!.processingStage, 'SORTING');
    rejects(() => ops.markReady(s, ctx(), { orderId: o.id, staffId: PROC }), 'STAGE_INCOMPLETE');
    rejects(() => ops.advanceStage(s, ctx(), { orderId: o.id, staffId: PROC, to: 'DRYING' }), 'STALE_STAGE');
    ops.advanceStage(s, ctx(), { orderId: o.id, staffId: PROC, to: 'WASHING' });
    // a second tap on the same step (or a colleague doing it at the same time) is refused
    rejects(() => ops.advanceStage(s, ctx(), { orderId: o.id, staffId: PROC, to: 'WASHING' }), 'STALE_STAGE');
    for (const to of ['DRYING', 'IRONING', 'QUALITY_CHECK'] as const) ops.advanceStage(s, ctx(), { orderId: o.id, staffId: PROC, to });
    rejects(() => ops.advanceStage(s, ctx(), { orderId: o.id, staffId: PROC, to: 'QUALITY_CHECK' }), 'STAGE_DONE');
    ops.markReady(s, ctx(), { orderId: o.id, staffId: PROC });
    assert.equal(findOrder(s, o.id)!.status, 'READY_FOR_DELIVERY');
    assert.equal(s.activities.filter((a) => a.orderId === o.id && a.type === 'STAGE_CHANGED').length, 5);
  });

  it('processing staff can’t accept orders or hand them over', () => {
    const o = findOrder(s, 'WB-1010')!;
    rejects(() => ops.acceptOrder(s, ctx(), { orderId: o.id, staffId: PROC, qrId: o.intakeQrId }), 'NO_PERMISSION');
  });

  it('only a supervisor assigns, and an assigned order belongs to that person', () => {
    const { o } = acceptedLpuOrder();
    rejects(() => ops.assignOrder(s, ctx(), { orderId: o.id, supervisorId: LPU, staffId: PROC }), 'NO_PERMISSION');
    rejects(() => ops.assignOrder(s, ctx(), { orderId: o.id, supervisorId: BOSS, staffId: NIT }), 'NO_STAFF');
    ops.assignOrder(s, ctx(), { orderId: o.id, supervisorId: BOSS, staffId: PROC });
    assert.equal(findOrder(s, o.id)!.assignedTo, PROC);
    rejects(() => ops.assignOrder(s, ctx(), { orderId: o.id, supervisorId: BOSS, staffId: PROC }), 'ALREADY_ASSIGNED');
    rejects(() => ops.startProcessing(s, ctx(), { orderId: o.id, staffId: LPU }), 'NOT_ASSIGNED');
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: PROC });
    ops.assignOrder(s, ctx(), { orderId: o.id, supervisorId: BOSS, staffId: null });
    assert.equal(findOrder(s, o.id)!.assignedTo, undefined);
    assert.ok(s.activities.some((a) => a.orderId === o.id && a.type === 'ASSIGNED'));
  });

  it('a staff-flagged issue blocks handover until an admin resolves it', () => {
    const { o, cust } = acceptedLpuOrder();
    ops.startProcessing(s, ctx(), { orderId: o.id, staffId: PROC });
    rejects(() => ops.reportStaffIssue(s, ctx(), { orderId: o.id, staffId: PROC, kind: 'DAMAGED', note: '' }), 'NO_DETAIL');
    const issue = ops.reportStaffIssue(s, ctx(), { orderId: o.id, staffId: PROC, kind: 'DAMAGED', note: 'Shirt collar torn on arrival' });
    assert.equal(issue.source, 'staff');
    rejects(() => ops.reportStaffIssue(s, ctx(), { orderId: o.id, staffId: PROC, kind: 'OTHER', note: 'Second report' }), 'ISSUE_OPEN');
    washThrough(o.id, PROC);
    ops.markReady(s, ctx(), { orderId: o.id, staffId: PROC });
    rejects(() => ops.handOver(s, ctx(), { orderId: o.id, staffId: LPU }), 'ISSUE_OPEN');
    rejects(() => ops.confirmClothes(s, ctx(), { orderId: o.id, customerId: cust, received: all(o.id) }), 'ISSUE_OPEN');
    ops.resolveIssue(s, ctx(), { issueId: issue.id, resolution: 'Customer agreed, discount given', adminName: 'Admin' });
    ops.handOver(s, ctx(), { orderId: o.id, staffId: LPU });
    assert.equal(findOrder(s, o.id)!.status, 'AWAITING_CUSTOMER_VERIFICATION');
  });
});

describe('garment lists', () => {
  it('bills a per-kg service from estimated weight and a per-piece service from the piece count', () => {
    const cust = newCustomer('Garment Tester', '9000000077');
    const o = ops.submitOrder(s, ctx(), {
      customerId: cust,
      locationId: 'loc-lpu',
      serviceMode: 'OFFICE_DROP_OFF',
      basket: [
        // 4 shirts (1.0 kg) + 2 jeans (1.3 kg) = 2.3 kg → billed as 2 kg
        { itemId: 'ow-normal', qty: 0, garments: [{ garmentId: 'shirt', qty: 4 }, { garmentId: 'jeans', qty: 2 }] },
        { itemId: 'dc-basic', qty: 0, garments: [{ garmentId: 'blazer', qty: 1 }, { garmentId: 'saree', qty: 2 }] },
      ],
    });
    const wash = o.lines.find((l) => l.itemId === 'ow-normal')!;
    assert.equal(wash.qty, 2);
    assert.deepEqual(wash.garments?.map((g) => [g.garmentId, g.qty]), [['shirt', 4], ['jeans', 2]]);
    const dry = o.lines.find((l) => l.itemId === 'dc-basic')!;
    assert.equal(dry.qty, 3);
    assert.equal(dry.amount, 3 * dry.unitPrice);
  });

  it('refuses a garment the service does not take', () => {
    const cust = newCustomer('Garment Tester', '9000000078');
    rejects(
      () => ops.submitOrder(s, ctx(), { customerId: cust, locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'wi-normal', qty: 0, garments: [{ garmentId: 'sneakers', qty: 1 }] }] }),
      'BAD_GARMENT',
    );
  });
});
