/**
 * Generates the seeded orders in src/mock/data by playing them through the real order engine, so every order,
 * payment, QR, receipt, issue, notification and activity in the demo data is consistent by construction.
 *
 *   node scripts/laundry/generate-seed.ts        (Node 22.18+, which runs TypeScript directly)
 *
 * Writes: walletAccounts, walletTransactions, orders, qrTokens, receipts, issues, notifications, orderActivities.
 * The hand-written files (locations, priceList, customers, staff) are inputs and are not changed.
 */
import * as ops from '../../src/mock/engine/ops.ts';
import { buildState } from '../../src/mock/engine/seed.ts';
import type { MockState, OpContext } from '../../src/mock/types.ts';
import { staticFiles, writeData } from './load.ts';

const s: MockState = buildState(staticFiles(), '2026-10-30T09:00:00.000Z');
const at = (iso: string): OpContext => ({ now: new Date(iso).toISOString() });

// every seeded customer gets a wallet and an opening top-up (Kiran's is small, to show a failed payment)
const OPENING: Record<string, number> = { 'u-1002': 1500, 'u-1003': 1200, 'u-1004': 2000, 'u-1005': 800, 'u-1006': 1000, 'u-1007': 1000, 'u-1008': 900, 'u-1009': 150, 'u-1010': 1500 };
for (const c of s.customers) {
  s.walletAccounts.push({ id: `wa-${c.id}`, customerId: c.id, currency: 'INR', status: 'ACTIVE', createdAt: c.createdAt });
  ops.topUp(s, at('2026-10-30T10:00:00+05:30'), { customerId: c.id, amount: OPENING[c.id] ?? 1000, bonus: 0, bonusPercent: 0 });
}

const LPU = 'st-lpu-01';
const NIT = 'st-nit-01';
const OUT = 'st-out-01';
const order = (id: string) => s.orders.find((o) => o.id === id)!;
const received = (id: string, change: Record<string, number> = {}) => Object.fromEntries(order(id).lines.map((l) => [l.itemId, change[l.itemId] ?? l.qty]));

function submitAndPay(time: string, input: ops.SubmitInput) {
  const o = ops.submitOrder(s, at(time), input);
  const t = new Date(Date.parse(time) + 60_000).toISOString();
  const paid = ops.payOrder(s, at(t), { orderId: o.id, customerId: o.customerId });
  if (!paid.ok) throw new Error(`seed: ${o.id} could not be paid`);
  return o.id;
}

/** The wash-floor steps after sorting, spread evenly between `from` and `until`, up to and including `upTo`. */
const STAGES = ['WASHING', 'DRYING', 'IRONING', 'QUALITY_CHECK'] as const;
function washStages(id: string, staffId: string, from: string, until: string, upTo: (typeof STAGES)[number] = 'QUALITY_CHECK') {
  const steps = STAGES.slice(0, STAGES.indexOf(upTo) + 1);
  const a = Date.parse(from);
  const span = (Date.parse(until) - a) / (steps.length + 1);
  steps.forEach((to, i) => ops.advanceStage(s, at(new Date(a + span * (i + 1)).toISOString()), { orderId: id, staffId, to }));
}

function deliver(id: string, staffId: string, times: { processing: string; ready: string; confirm: string; deliver: string }) {
  ops.startProcessing(s, at(times.processing), { orderId: id, staffId });
  washStages(id, staffId, times.processing, times.ready);
  ops.markReady(s, at(times.ready), { orderId: id, staffId });
  ops.confirmClothes(s, at(times.confirm), { orderId: id, customerId: order(id).customerId, received: received(id) });
  ops.confirmDelivery(s, at(times.deliver), { orderId: id, staffId, qrId: order(id).deliveryQrId! });
}

// WB-1001 · Rohit · NIT · delivered
const a = submitAndPay('2026-10-31T10:05:00+05:30', { customerId: 'u-1005', locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'wi-normal', qty: 5 }, { itemId: 'wi-ezee', qty: 3 }, { itemId: 'ow-normal', qty: 2 }] });
ops.acceptOrder(s, at('2026-10-31T10:14:00+05:30'), { orderId: a, staffId: NIT, qrId: order(a).intakeQrId });
deliver(a, NIT, { processing: '2026-10-31T13:00:00+05:30', ready: '2026-11-01T17:20:00+05:30', confirm: '2026-11-02T11:00:00+05:30', deliver: '2026-11-02T11:02:00+05:30' });

// WB-1002 · Meera · LPU · delivered
const b = submitAndPay('2026-11-01T10:05:00+05:30', { customerId: 'u-1002', locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 6 }, { itemId: 'ow-ezee', qty: 2 }, { itemId: 'ow-whites', qty: 1 }], instructions: 'Please fold the T-shirts separately.' });
ops.acceptOrder(s, at('2026-11-01T10:12:00+05:30'), { orderId: b, staffId: LPU, qrId: order(b).intakeQrId });
deliver(b, LPU, { processing: '2026-11-01T14:00:00+05:30', ready: '2026-11-02T17:30:00+05:30', confirm: '2026-11-03T11:00:00+05:30', deliver: '2026-11-03T11:02:00+05:30' });

// WB-1003 · Meera · LPU · ready, and Meera reported a missing shirt (open issue)
const c = submitAndPay('2026-11-02T12:00:00+05:30', { customerId: 'u-1002', locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'wi-normal', qty: 4 }, { itemId: 'wi-whites', qty: 2 }] });
ops.acceptOrder(s, at('2026-11-02T12:09:00+05:30'), { orderId: c, staffId: LPU, qrId: order(c).intakeQrId });
ops.startProcessing(s, at('2026-11-02T15:00:00+05:30'), { orderId: c, staffId: LPU });
washStages(c, LPU, '2026-11-02T15:00:00+05:30', '2026-11-04T16:00:00+05:30');
ops.markReady(s, at('2026-11-04T16:00:00+05:30'), { orderId: c, staffId: LPU });
ops.reportIssue(s, at('2026-11-04T18:30:00+05:30'), { orderId: c, customerId: 'u-1002', kind: 'MISSING_ITEMS', received: received(c, { 'wi-normal': 3 }), note: 'One white formal shirt is missing.' });

// WB-1004 · Kavya · Outside · home pickup, ready and on its way back
const d = submitAndPay('2026-11-02T19:00:00+05:30', {
  customerId: 'u-1004',
  locationId: 'loc-outside',
  serviceMode: 'HOME_PICKUP',
  basket: [{ itemId: 'wi-normal', qty: 2 }, { itemId: 'dc-premium', qty: 1 }, { itemId: 'ow-normal', qty: 2 }],
  pickup: { address: 'Flat 302, Green Avenue Apartments, Model Town, Jalandhar', landmark: 'Opposite City Park', contactPhone: '9886231361', date: '2026-11-03', slotId: 'hp-morning' },
  instructions: 'Call before arriving. Sarees are delicate.',
});
ops.acceptOrder(s, at('2026-11-03T08:40:00+05:30'), { orderId: d, staffId: OUT, qrId: order(d).intakeQrId });
ops.startProcessing(s, at('2026-11-03T13:00:00+05:30'), { orderId: d, staffId: OUT });
washStages(d, OUT, '2026-11-03T13:00:00+05:30', '2026-11-04T18:00:00+05:30');
ops.markReady(s, at('2026-11-04T18:00:00+05:30'), { orderId: d, staffId: OUT });

// WB-1005 · Arjun · NIT · processing
const e = submitAndPay('2026-11-03T09:40:00+05:30', { customerId: 'u-1003', locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 4 }, { itemId: 'ow-whites', qty: 3 }, { itemId: 'sb-machine', qty: 1 }] });
ops.acceptOrder(s, at('2026-11-03T09:50:00+05:30'), { orderId: e, staffId: NIT, qrId: order(e).intakeQrId });
ops.startProcessing(s, at('2026-11-03T12:00:00+05:30'), { orderId: e, staffId: NIT });
// the wash floor has it at drying
washStages(e, 'st-nit-03', '2026-11-03T12:00:00+05:30', '2026-11-04T12:00:00+05:30', 'DRYING');

// WB-1006 · Sana · LPU · rejected, refunded
const f = submitAndPay('2026-11-04T16:00:00+05:30', { customerId: 'u-1008', locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'st-colour', qty: 2 }, { itemId: 'dc-basic', qty: 1 }] });
ops.rejectOrder(s, at('2026-11-04T16:08:00+05:30'), { orderId: f, staffId: LPU, qrId: order(f).intakeQrId, reason: 'Paint stains need specialist treatment we don’t offer at this office' });

// WB-1007 · Aditya · Outside · home pickup paid, waiting for the partner
submitAndPay('2026-11-04T21:00:00+05:30', {
  customerId: 'u-1010',
  locationId: 'loc-outside',
  serviceMode: 'HOME_PICKUP',
  basket: [{ itemId: 'ow-normal', qty: 6 }, { itemId: 'wi-normal', qty: 3 }, { itemId: 'ow-whites', qty: 4 }],
  pickup: { address: 'House 118, Urban Estate Phase 2, Jalandhar', contactPhone: '9808448464', date: '2026-11-05', slotId: 'hp-noon' },
});

// WB-1008 · Kiran · Outside · drop-off, payment failed (wallet too low), still unpaid
const h = ops.submitOrder(s, at('2026-11-05T08:30:00+05:30'), { customerId: 'u-1009', locationId: 'loc-outside', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'bl-normal-double', qty: 1 }] });
ops.payOrder(s, at('2026-11-05T08:31:00+05:30'), { orderId: h.id, customerId: 'u-1009' });

// WB-1009 · Vikram · NIT · paid, waiting at the counter
submitAndPay('2026-11-05T08:55:00+05:30', { customerId: 'u-1007', locationId: 'loc-nit', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'wi-normal', qty: 3 }, { itemId: 'wi-whites', qty: 2 }] });

// WB-1010 · Priya · LPU · paid, waiting at the counter
submitAndPay('2026-11-05T09:10:00+05:30', { customerId: 'u-1006', locationId: 'loc-lpu', serviceMode: 'OFFICE_DROP_OFF', basket: [{ itemId: 'ow-normal', qty: 5 }, { itemId: 'ow-ezee', qty: 2 }, { itemId: 'ow-whites', qty: 2 }] });

// customers of seeded orders have already seen their receipts and read older messages
s.receipts.forEach((r) => (r.animationShownAt = r.issuedAt));
s.notifications.forEach((n) => {
  if (Date.parse(n.createdAt) < Date.parse('2026-11-04T00:00:00+05:30')) n.readAt = n.createdAt;
});

writeData('walletAccounts.json', s.walletAccounts);
writeData('walletTransactions.json', s.walletTransactions);
writeData('orders.json', s.orders);
writeData('qrTokens.json', s.qrTokens);
writeData('receipts.json', s.receipts);
writeData('issues.json', s.issues);
writeData('notifications.json', s.notifications);
writeData('orderActivities.json', s.activities);

console.log(`Seeded ${s.orders.length} orders, ${s.walletTransactions.length} wallet transactions, ${s.qrTokens.length} QR tokens, ${s.activities.length} activities.`);
console.log(s.orders.map((o) => `${o.id} ${o.status.padEnd(30)} ${o.locationId}`).join('\n'));
