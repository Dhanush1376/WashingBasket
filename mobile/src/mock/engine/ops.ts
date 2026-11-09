/**
 * Every business operation of the laundry system, as a plain function over the state.
 *
 * Each one checks its rules first and throws a MockError (changing nothing) when a rule says no. The store runs
 * them on a copy and only keeps the copy if the operation finished, so a refused step can never half-happen.
 * MOCK ONLY: these rules mirror what a real backend must enforce; running them on a device is not security.
 */
import type {
  Actor,
  IssueKind,
  ProcessingStage,
  LaundryOrder,
  MockState,
  OpContext,
  OrderLine,
  QrPurpose,
  ServiceMode,
  Staff,
  StaffPermission,
  WalletTransaction,
} from '../types.ts';
import { intakePurpose, isTerminal, MODE_COPY, nextStage, STAGE_COPY } from './lifecycle.ts';
import { activateQr, consumeQr, issueQr, revokeQr } from './qr.ts';
import { actorForCustomer, actorForStaff, logActivity, notify, transition } from './records.ts';
import { findCustomer, findLocation, findOrder, findQr, findStaff, openIssueFor, priceBasket, walletBalance } from './selectors.ts';
import { fail, formatPhone, nextNumber, phoneDigits, localDay, rupees, slotStarted } from './util.ts';

/** Every new demo customer starts with this much mock credit, so the flow can be tried end to end. */
export const WELCOME_CREDIT = 1500;
export const MAX_QTY_PER_ITEM = 50;

/* ───────────── Customers and wallet ───────────── */

export function ensureCustomer(s: MockState, ctx: OpContext, input: { authKey: string; name: string; phone: string; email?: string; homeLocationId?: string }) {
  const existing = s.customers.find((c) => c.authKey === input.authKey);
  if (existing) {
    // the details typed during sign-in win, so the counter and the admin see the customer's real name
    if (input.name.trim() && existing.name !== input.name.trim()) existing.name = input.name.trim();
    if (input.email && existing.email !== input.email) existing.email = input.email;
    if (input.homeLocationId) existing.homeLocationId = input.homeLocationId;
    return existing;
  }
  const id = `u-${nextNumber(s, 'customer')}`;
  const customer = {
    id,
    name: input.name.trim() || 'Washing Basket customer',
    phone: input.phone ? formatPhone(input.phone) : '',
    authKey: input.authKey,
    email: input.email,
    homeLocationId: input.homeLocationId,
    createdAt: ctx.now,
    status: 'ACTIVE' as const,
  };
  s.customers.push(customer);
  s.walletAccounts.push({ id: `wa-${id}`, customerId: id, currency: 'INR', status: 'ACTIVE', createdAt: ctx.now });
  addTxn(s, ctx, { customerId: id, type: 'credit', source: 'bonus', amount: WELCOME_CREDIT, title: 'Welcome credit (demo, no real money)', status: 'completed' });
  return customer;
}

function addTxn(s: MockState, ctx: OpContext, t: Omit<WalletTransaction, 'id' | 'date'>): WalletTransaction {
  if (t.idempotencyKey && s.walletTransactions.some((x) => x.idempotencyKey === t.idempotencyKey)) {
    fail('DUPLICATE_TXN', 'This payment was already recorded.');
  }
  const txn: WalletTransaction = { id: `wt-${nextNumber(s, 'txn')}`, date: ctx.now, ...t };
  s.walletTransactions.unshift(txn);
  return txn;
}

/** DEMO ONLY: credits the mock wallet. No payment gateway is involved and no money moves. */
export function topUp(s: MockState, ctx: OpContext, input: { customerId: string; amount: number; bonus: number; bonusPercent: number }) {
  if (!findCustomer(s, input.customerId)) fail('NO_CUSTOMER', 'Customer not found.');
  if (!(input.amount > 0)) fail('BAD_AMOUNT', 'Enter an amount to add.');
  addTxn(s, ctx, { customerId: input.customerId, type: 'credit', source: 'topup', amount: input.amount, title: 'Top-up (demo, no charge)', status: 'completed' });
  if (input.bonus > 0) {
    addTxn(s, ctx, { customerId: input.customerId, type: 'credit', source: 'bonus', amount: input.bonus, title: `${input.bonusPercent}% top-up bonus`, status: 'completed' });
  }
  return walletBalance(s, input.customerId);
}

/* ───────────── Ordering ───────────── */

export type SubmitInput = {
  customerId: string;
  locationId: string;
  serviceMode: ServiceMode;
  basket: { itemId: string; qty: number }[];
  pickup?: { address: string; landmark?: string; contactPhone: string; date: string; slotId: string };
  instructions?: string;
  discount?: number;
  couponCode?: string;
};

export function submitOrder(s: MockState, ctx: OpContext, input: SubmitInput): LaundryOrder {
  const customer = findCustomer(s, input.customerId);
  if (!customer || customer.status !== 'ACTIVE') fail('NO_CUSTOMER', 'Sign in to place an order.');
  const location = findLocation(s, input.locationId);
  if (!location) return fail('NO_LOCATION', 'Choose a location.');
  if (location.status !== 'ACTIVE') fail('LOCATION_PAUSED', `${location.shortName} isn’t taking orders right now.`);
  if (!location.serviceModes.includes(input.serviceMode)) fail('MODE_UNAVAILABLE', `${MODE_COPY[input.serviceMode].label} isn’t offered at ${location.shortName}.`);

  for (const b of input.basket) {
    if (!Number.isInteger(b.qty) || b.qty < 0 || b.qty > MAX_QTY_PER_ITEM) fail('BAD_QTY', `Quantities must be between 1 and ${MAX_QTY_PER_ITEM}.`);
  }
  const priced = priceBasket(s, input.serviceMode, input.basket);
  if (!priced.lines.length) fail('EMPTY', 'Add at least one item.');
  if (priced.lines.length !== input.basket.filter((b) => b.qty > 0).length) fail('UNKNOWN_ITEM', 'An item in your basket is no longer on the price list.');

  let pickup: LaundryOrder['pickup'];
  if (input.serviceMode === 'HOME_PICKUP') {
    const p = input.pickup;
    if (!p) return fail('NO_PICKUP', 'Add your pickup details.');
    if (p.address.trim().length < 8) fail('BAD_ADDRESS', 'Enter the full pickup address.');
    if (phoneDigits(p.contactPhone).length !== 10) fail('BAD_PHONE', 'Enter a 10-digit contact number.');
    const slot = location.homePickup?.slots.find((x) => x.id === p.slotId);
    if (!slot) return fail('BAD_SLOT', 'Choose a pickup time.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || p.date < localDay(new Date(ctx.now))) fail('BAD_DATE', 'Choose a pickup day from today onwards.');
    if (slotStarted(slot, p.date, ctx.now)) fail('SLOT_PASSED', 'That pickup time has already started today. Choose a later time or another day.');
    pickup = { address: p.address.trim(), landmark: p.landmark?.trim() || undefined, contactPhone: formatPhone(p.contactPhone), date: p.date, slotId: slot.id, slotLabel: slot.label };
  }

  const lines: OrderLine[] = priced.lines.map((l) => ({
    itemId: l.item.id,
    name: l.item.name,
    icon: l.item.icon,
    categoryId: l.categoryId,
    categoryName: l.categoryName,
    unit: l.item.unit,
    unitPrice: l.item.price,
    qty: l.qty,
    amount: l.amount,
  }));

  const order: LaundryOrder = {
    id: `WB-${nextNumber(s, 'order')}`,
    customerId: input.customerId,
    locationId: location.id,
    serviceMode: input.serviceMode,
    status: 'REQUEST_SUBMITTED',
    lines,
    pieces: priced.pieces,
    subtotal: priced.subtotal,
    serviceCharge: priced.serviceCharge,
    total: input.discount ? Math.max(0, priced.total - input.discount) : priced.total,
    discount: input.discount || undefined,
    couponCode: input.couponCode || undefined,
    pickup,
    instructions: input.instructions?.trim() || undefined,
    payment: { status: 'REQUIRED', amount: input.discount ? Math.max(0, priced.total - input.discount) : priced.total, method: 'WALLET', failedAttempts: 0 },
    intakeQrId: '',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  s.orders.unshift(order);
  const actor = actorForCustomer(s, input.customerId);
  logActivity(s, ctx, order, 'STATUS_CHANGED', actor, input.serviceMode === 'HOME_PICKUP' ? 'Pickup request submitted' : 'Request submitted', { to: 'REQUEST_SUBMITTED' });

  const qr = issueQr(s, ctx, order, intakePurpose(input.serviceMode), false);
  order.intakeQrId = qr.id;
  logActivity(s, ctx, order, 'QR_ISSUED', actor, 'QR created, locked until payment');
  transition(s, ctx, order, 'PAYMENT_PENDING', actor, `Waiting for payment of ${rupees(order.total)}`);
  notify(s, ctx, 'customer', order.customerId, 'ORDER_SUBMITTED', `Request ${order.id} submitted`, `Pay ${rupees(order.total)} from your wallet to unlock your QR code.`, order.id);
  return order;
}

export type PayResult = { ok: true; txnId: string; balance: number } | { ok: false; balance: number; shortfall: number };

/**
 * Pays an order from the customer's wallet, exactly once. If the balance is short, the attempt is recorded as
 * failed (nothing is debited and the QR stays locked) and the result says by how much.
 */
export function payOrder(s: MockState, ctx: OpContext, input: { orderId: string; customerId: string; discount?: number; couponCode?: string }): PayResult {
  const order = findOrder(s, input.orderId);
  if (!order || order.customerId !== input.customerId) return fail('NO_ORDER', 'Order not found.');
  if (order.payment.status === 'COMPLETED' || s.walletTransactions.some((t) => t.idempotencyKey === `pay:${order.id}`)) {
    fail('ALREADY_PAID', `Order ${order.id} is already paid.`);
  }
  if (order.status !== 'PAYMENT_PENDING') fail('BAD_STATE', `Order ${order.id} can’t be paid now.`);

  if (input.discount && input.discount > 0) {
    order.discount = input.discount;
    order.couponCode = input.couponCode;
    order.total = Math.max(0, order.subtotal + order.serviceCharge - input.discount);
  }

  const balance = walletBalance(s, order.customerId);
  const actor = actorForCustomer(s, order.customerId);
  if (balance < order.total) {
    const shortfall = order.total - balance;
    order.payment.status = 'FAILED';
    order.payment.failedAttempts += 1;
    order.payment.lastFailure = { at: ctx.now, reason: 'Insufficient wallet balance', balance, shortfall };
    order.updatedAt = ctx.now;
    logActivity(s, ctx, order, 'PAYMENT_FAILED', actor, `Payment failed: wallet balance ${rupees(balance)} is ${rupees(shortfall)} short`);
    notify(s, ctx, 'customer', order.customerId, 'PAYMENT_FAILED', 'Payment didn’t go through', `Your wallet is ${rupees(shortfall)} short for ${order.id}. Add money and try again — nothing was charged.`, order.id);
    return { ok: false, balance, shortfall };
  }

  const txn = addTxn(s, ctx, {
    customerId: order.customerId,
    type: 'debit',
    source: 'order',
    amount: order.total,
    title: `Order #${order.id}`,
    status: 'completed',
    orderId: order.id,
    idempotencyKey: `pay:${order.id}`,
  });
  order.payment = { ...order.payment, status: 'COMPLETED', txnId: txn.id, paidAt: ctx.now, lastFailure: undefined };
  logActivity(s, ctx, order, 'PAYMENT_COMPLETED', actor, `Paid ${rupees(order.total)} from wallet (${txn.id})`);
  const qr = findQr(s, order.intakeQrId);
  if (!qr || qr.status !== 'LOCKED') fail('QR_STATE', 'The order’s QR is not in a payable state.');
  activateQr(qr!, ctx);
  logActivity(s, ctx, order, 'QR_UNLOCKED', actor, 'QR unlocked');
  transition(s, ctx, order, 'PAYMENT_COMPLETED', actor);
  transition(s, ctx, order, 'AWAITING_STAFF_ACCEPTANCE', actor, order.serviceMode === 'HOME_PICKUP' ? 'Waiting for the pickup partner' : 'Waiting for staff at the counter');
  const loc = findLocation(s, order.locationId);
  notify(
    s,
    ctx,
    'customer',
    order.customerId,
    'PAYMENT_COMPLETED',
    'Paid — your QR is unlocked',
    order.serviceMode === 'HOME_PICKUP' ? `Show the QR for ${order.id} to our pickup partner when they arrive.` : `Show the QR for ${order.id} at the ${loc?.shortName ?? ''} counter.`,
    order.id,
  );
  notify(s, ctx, 'staff', order.locationId, 'NEW_REQUEST', order.serviceMode === 'HOME_PICKUP' ? `New pickup ${order.id}` : `New drop-off ${order.id}`, `${order.pieces} pieces · ${rupees(order.total)} paid`, order.id);
  return { ok: true, txnId: txn.id, balance: walletBalance(s, order.customerId) };
}

/** Puts the money back, once. Used when staff reject a paid order or the customer cancels before acceptance. */
function reversePayment(s: MockState, ctx: OpContext, order: LaundryOrder, actor: Actor, why: string) {
  if (order.payment.status !== 'COMPLETED') return;
  const txn = addTxn(s, ctx, {
    customerId: order.customerId,
    type: 'refund',
    source: 'refund',
    amount: order.payment.amount,
    title: `Refund · Order #${order.id}`,
    status: 'completed',
    orderId: order.id,
    idempotencyKey: `reverse:${order.id}`,
  });
  order.payment = { ...order.payment, status: 'REVERSED', reversalTxnId: txn.id, reversedAt: ctx.now };
  logActivity(s, ctx, order, 'PAYMENT_REVERSED', actor, `${rupees(order.payment.amount)} returned to wallet (${txn.id}): ${why}`);
  notify(s, ctx, 'customer', order.customerId, 'REFUND_ISSUED', `${rupees(order.payment.amount)} refunded`, `The payment for ${order.id} is back in your wallet.`, order.id);
}

export function cancelOrder(s: MockState, ctx: OpContext, input: { orderId: string; customerId: string; reason: string }) {
  const order = findOrder(s, input.orderId);
  if (!order || order.customerId !== input.customerId) return fail('NO_ORDER', 'Order not found.');
  if (order.status !== 'PAYMENT_PENDING' || order.payment.status === 'COMPLETED') return fail('BAD_STATE', 'Paid orders cannot be cancelled.');
  const actor = actorForCustomer(s, order.customerId);
  revokeQr(findQr(s, order.intakeQrId), ctx, 'Order cancelled');
  logActivity(s, ctx, order, 'QR_REVOKED', actor, 'QR cancelled with the order');
  reversePayment(s, ctx, order, actor, 'cancelled by customer');
  order.cancelledAt = ctx.now;
  order.cancelReason = input.reason.trim() || 'Cancelled by customer';
  transition(s, ctx, order, 'CANCELLED', actor, `Cancelled by customer: ${order.cancelReason}`);
  notify(s, ctx, 'customer', order.customerId, 'ORDER_CANCELLED', `${order.id} cancelled`, order.payment.status === 'REVERSED' ? 'Your payment is back in your wallet.' : 'Nothing was charged.', order.id);
  return order;
}

/** Replaces an expired (or about-to-expire) QR with a fresh one. The old code stops working at once. */
export function refreshQr(s: MockState, ctx: OpContext, input: { orderId: string; customerId: string; purpose: 'INTAKE' | 'DELIVERY' }) {
  const order = findOrder(s, input.orderId);
  if (!order || order.customerId !== input.customerId) return fail('NO_ORDER', 'Order not found.');
  const actor = actorForCustomer(s, order.customerId);
  if (input.purpose === 'INTAKE') {
    if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') fail('BAD_STATE', 'This QR can’t be refreshed now.');
    revokeQr(findQr(s, order.intakeQrId), ctx, 'Replaced by a fresh QR');
    order.intakeQrId = issueQr(s, ctx, order, intakePurpose(order.serviceMode), true).id;
  } else {
    if (order.status !== 'AWAITING_CUSTOMER_VERIFICATION' || !order.verification) fail('NOT_VERIFIED', 'Check your clothes first.');
    revokeQr(findQr(s, order.deliveryQrId), ctx, 'Replaced by a fresh QR');
    order.deliveryQrId = issueQr(s, ctx, order, 'CUSTOMER_DELIVERY_VERIFICATION', true).id;
  }
  order.updatedAt = ctx.now;
  logActivity(s, ctx, order, 'QR_ISSUED', actor, 'QR refreshed; the previous code no longer works');
  return order;
}

/* ───────────── Delivery verification (customer) ───────────── */

/** The clothes are with the customer for checking: started by staff at hand-over, or by the customer. */
export function startCheck(s: MockState, ctx: OpContext, order: LaundryOrder, actor: Actor) {
  if (order.status !== 'READY_FOR_DELIVERY') return;
  transition(s, ctx, order, 'AWAITING_CUSTOMER_VERIFICATION', actor, actor.kind === 'customer' ? 'Customer started checking the clothes' : 'Clothes handed over for checking');
}

export function confirmClothes(s: MockState, ctx: OpContext, input: { orderId: string; customerId: string; received: Record<string, number> }) {
  const order = findOrder(s, input.orderId);
  if (!order || order.customerId !== input.customerId) return fail('NO_ORDER', 'Order not found.');
  const open = openIssueFor(s, order.id);
  if (open) fail('ISSUE_OPEN', open.source === 'staff' ? 'Our team flagged a problem with this order. We’ll be in touch before it can be handed over.' : 'You reported a problem with this order. We’ll be in touch before delivery can be completed.');
  if (order.status !== 'READY_FOR_DELIVERY' && order.status !== 'AWAITING_CUSTOMER_VERIFICATION') fail('BAD_STATE', 'This order isn’t ready to be checked.');
  const mismatch = order.lines.find((l) => (input.received[l.itemId] ?? -1) !== l.qty);
  if (mismatch) fail('COUNT_MISMATCH', `${mismatch.name}: the count doesn’t match. Report an issue instead.`);
  const actor = actorForCustomer(s, order.customerId);
  startCheck(s, ctx, order, actor);
  if (order.verification && findQr(s, order.deliveryQrId)?.status === 'ACTIVE') return order; // already confirmed
  order.verification = { confirmedAt: ctx.now, piecesConfirmed: order.pieces };
  order.deliveryQrId = issueQr(s, ctx, order, 'CUSTOMER_DELIVERY_VERIFICATION', true).id;
  order.updatedAt = ctx.now;
  logActivity(s, ctx, order, 'VERIFICATION_CONFIRMED', actor, `Customer confirmed all ${order.pieces} pieces`);
  logActivity(s, ctx, order, 'QR_ISSUED', actor, 'Delivery QR created');
  notify(s, ctx, 'staff', order.locationId, 'DELIVERY_QR_READY', `${order.id} verified by customer`, 'Scan their delivery QR to complete the delivery.', order.id);
  return order;
}

export function reportIssue(s: MockState, ctx: OpContext, input: { orderId: string; customerId: string; kind: IssueKind; received: Record<string, number>; note: string }) {
  const order = findOrder(s, input.orderId);
  if (!order || order.customerId !== input.customerId) return fail('NO_ORDER', 'Order not found.');
  if (order.status !== 'READY_FOR_DELIVERY' && order.status !== 'AWAITING_CUSTOMER_VERIFICATION') fail('BAD_STATE', 'Issues can be reported while checking your clothes.');
  if (openIssueFor(s, order.id)) fail('ISSUE_OPEN', 'You already reported an issue for this order.');
  const mismatches = order.lines
    .filter((l) => input.received[l.itemId] !== undefined && input.received[l.itemId] !== l.qty)
    .map((l) => ({ itemId: l.itemId, name: l.name, expected: l.qty, received: input.received[l.itemId] }));
  if (!mismatches.length && input.note.trim().length < 5) fail('NO_DETAIL', 'Tell us what’s wrong in a few words.');
  const actor = actorForCustomer(s, order.customerId);
  startCheck(s, ctx, order, actor);
  // a verification given earlier no longer stands
  revokeQr(findQr(s, order.deliveryQrId), ctx, 'Issue reported');
  order.verification = undefined;
  order.updatedAt = ctx.now;
  const issue = { id: `iss-${nextNumber(s, 'issue')}`, orderId: order.id, customerId: order.customerId, kind: input.kind, mismatches, note: input.note.trim(), status: 'OPEN' as const, reportedAt: ctx.now };
  s.issues.unshift(issue);
  const summary = mismatches.length ? mismatches.map((m) => `${m.name} ${m.received}/${m.expected}`).join(', ') : input.note.trim();
  logActivity(s, ctx, order, 'ISSUE_REPORTED', actor, `Issue reported: ${summary}`);
  notify(s, ctx, 'admin', 'admin', 'ISSUE_REPORTED', `Issue on ${order.id}`, summary, order.id);
  notify(s, ctx, 'staff', order.locationId, 'ISSUE_REPORTED', `Issue on ${order.id}`, summary, order.id);
  notify(s, ctx, 'customer', order.customerId, 'ISSUE_REPORTED', 'We’re on it', `Your report for ${order.id} reached our team. The order stays open until it’s sorted.`, order.id);
  return issue;
}

/* ───────────── Staff ───────────── */

/** Demo staff sign-in: the shared demo number plus the location PIN code picks the staff account. */
export function staffSignIn(s: MockState, input: { phone: string; pincode: string }): Staff {
  const loc = s.locations.find((l) => l.pincode === input.pincode);
  if (!loc) return fail('NO_LOCATION', 'No location uses this PIN code.');
  const staff = s.staff.find((x) => x.demoLogin && x.locationId === loc.id && phoneDigits(x.phone) === phoneDigits(input.phone));
  if (!staff) return fail('NO_STAFF', `There’s no staff account for this number at ${loc.shortName}.`);
  if (staff.status !== 'ACTIVE') fail('SUSPENDED', 'This staff account is paused. Ask an admin to reactivate it.');
  return staff;
}

function assertStaff(s: MockState, staffId: string, order: LaundryOrder, permission: StaffPermission): Staff {
  const staff = findStaff(s, staffId);
  if (!staff) return fail('NO_STAFF', 'Staff account not found.');
  if (staff.status !== 'ACTIVE') fail('SUSPENDED', 'This staff account is paused.');
  if (staff.locationId !== order.locationId) fail('WRONG_LOCATION', 'You can only process orders for your own location.');
  if (!staff.permissions.includes(permission)) fail('NO_PERMISSION', 'Your role can’t do this.');
  // an order a supervisor gave to someone is theirs: colleagues can't act on it (supervisors still can)
  if (order.assignedTo && order.assignedTo !== staff.id && !staff.permissions.includes('ORDER_ASSIGN')) {
    fail('NOT_ASSIGNED', `This order is assigned to ${findStaff(s, order.assignedTo)?.name ?? 'someone else'}.`);
  }
  return staff;
}

function staffOrder(s: MockState, orderId: string) {
  const order = findOrder(s, orderId);
  if (!order) return fail('NO_ORDER', 'Order not found.');
  return order;
}

export function acceptOrder(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string; qrId: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ORDER_ACCEPT');
  if (order.serviceMode === 'HOME_PICKUP') assertStaff(s, input.staffId, order, 'PICKUP_COLLECT');
  if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') fail('BAD_STATE', `Order ${order.id} isn’t waiting for acceptance.`);
  if (order.payment.status !== 'COMPLETED' || !s.walletTransactions.some((t) => t.idempotencyKey === `pay:${order.id}`)) fail('NOT_PAID', 'This order hasn’t been paid.');
  consumeQr(s, ctx, input.qrId, { orderId: order.id, purpose: intakePurpose(order.serviceMode), staffId: input.staffId });

  const actor = actorForStaff(s, input.staffId);
  order.acceptedBy = input.staffId;
  order.acceptedAt = ctx.now;
  transition(s, ctx, order, 'ACCEPTED', actor, `Accepted by ${actor.name}`);
  if (order.serviceMode === 'HOME_PICKUP') transition(s, ctx, order, 'PICKUP_CONFIRMED', actor, `Laundry collected by ${actor.name}`);

  const receipt = { id: `rc-${order.id}`, number: `WBR-${nextNumber(s, 'receipt')}`, orderId: order.id, customerId: order.customerId, issuedAt: ctx.now, acceptedBy: input.staffId };
  s.receipts.unshift(receipt);
  order.receiptId = receipt.id;
  logActivity(s, ctx, order, 'RECEIPT_ISSUED', actor, `Receipt ${receipt.number} issued`);
  notify(s, ctx, 'customer', order.customerId, 'ORDER_ACCEPTED', `${order.id} accepted`, `Your receipt ${receipt.number} is ready.`, order.id);
  return order;
}

export function rejectOrder(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string; qrId: string; reason: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ORDER_REJECT');
  if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') fail('BAD_STATE', `Order ${order.id} isn’t waiting for acceptance.`);
  const reason = input.reason.trim();
  if (reason.length < 3) fail('NO_REASON', 'Give a reason for rejecting.');
  consumeQr(s, ctx, input.qrId, { orderId: order.id, purpose: intakePurpose(order.serviceMode), staffId: input.staffId });
  const actor = actorForStaff(s, input.staffId);
  reversePayment(s, ctx, order, actor, `rejected: ${reason}`);
  order.rejectedBy = input.staffId;
  order.rejectedAt = ctx.now;
  order.rejectionReason = reason;
  transition(s, ctx, order, 'REJECTED', actor, `Rejected by ${actor.name}: ${reason}`);
  notify(s, ctx, 'customer', order.customerId, 'ORDER_REJECTED', `${order.id} wasn’t accepted`, `${reason}. Your payment has been refunded to your wallet.`, order.id);
  return order;
}

export function startProcessing(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ORDER_PROCESS');
  const actor = actorForStaff(s, input.staffId);
  order.processingBy = input.staffId;
  transition(s, ctx, order, 'PROCESSING', actor, `Processing started by ${actor.name}`);
  order.processingStage = 'SORTING';
  logActivity(s, ctx, order, 'STAGE_CHANGED', actor, `${STAGE_COPY.SORTING.label} started by ${actor.name}`);
  notify(s, ctx, 'customer', order.customerId, 'PROCESSING', `${order.id} is being washed`, 'We’ll tell you the moment it’s ready.', order.id);
  return order;
}

/**
 * Moves a processing order to its next wash-floor step. `to` is the step the staff member saw on screen: if someone
 * else moved the order meanwhile, it no longer matches and nothing changes, so a step is never skipped or repeated.
 */
export function advanceStage(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string; to: ProcessingStage }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ORDER_PROCESS');
  if (order.status !== 'PROCESSING') fail('BAD_STATE', `Order ${order.id} isn’t being processed.`);
  const next = nextStage(order.processingStage);
  if (!next) return fail('STAGE_DONE', 'Quality check is the last step. Mark the order ready.');
  if (next !== input.to) fail('STALE_STAGE', `${order.id} is already at ${STAGE_COPY[order.processingStage ?? 'SORTING'].label.toLowerCase()}. Refresh and try again.`);
  const actor = actorForStaff(s, input.staffId);
  order.processingStage = next;
  order.processingBy = input.staffId;
  order.updatedAt = ctx.now;
  logActivity(s, ctx, order, 'STAGE_CHANGED', actor, `${STAGE_COPY[next].label} started by ${actor.name}`);
  return order;
}

export function markReady(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ORDER_PROCESS');
  // orders processed in stages must pass quality check first (older orders without stages go straight through)
  if (order.status === 'PROCESSING' && order.processingStage && order.processingStage !== 'QUALITY_CHECK') {
    fail('STAGE_INCOMPLETE', `${order.id} is still at ${STAGE_COPY[order.processingStage].label.toLowerCase()}. Finish quality check first.`);
  }
  const actor = actorForStaff(s, input.staffId);
  order.readyBy = input.staffId;
  transition(s, ctx, order, 'READY_FOR_DELIVERY', actor, `Marked ready by ${actor.name}`);
  const loc = findLocation(s, order.locationId);
  notify(
    s,
    ctx,
    'customer',
    order.customerId,
    'READY',
    order.serviceMode === 'HOME_PICKUP' ? `${order.id} is on its way` : `${order.id} is ready to collect`,
    order.serviceMode === 'HOME_PICKUP'
      ? 'Our partner is bringing it back. Check your clothes before confirming delivery.'
      : `Collect it at ${loc?.office.name ?? 'our office'}. Check your clothes before confirming.`,
    order.id,
  );
  return order;
}

/** Staff hand the clothes over for checking (counter or doorstep). The customer can also start this themselves. */
export function handOver(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'DELIVERY_CONFIRM');
  // a home order is handed over at the customer's door, by the pickup & delivery partner
  if (order.serviceMode === 'HOME_PICKUP') assertStaff(s, input.staffId, order, 'PICKUP_COLLECT');
  if (order.status !== 'READY_FOR_DELIVERY') fail('BAD_STATE', `Order ${order.id} isn’t ready.`);
  if (openIssueFor(s, order.id)) fail('ISSUE_OPEN', 'There’s an open issue on this order. An admin has to resolve it first.');
  order.handoverBy = input.staffId;
  startCheck(s, ctx, order, actorForStaff(s, input.staffId));
  notify(s, ctx, 'customer', order.customerId, 'VERIFY_CLOTHES', 'Please check your clothes', `Count the pieces for ${order.id}, then show your delivery QR.`, order.id);
  return order;
}

export function confirmDelivery(s: MockState, ctx: OpContext, input: { orderId: string; staffId: string; qrId: string }) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'DELIVERY_CONFIRM');
  if (order.serviceMode === 'HOME_PICKUP') assertStaff(s, input.staffId, order, 'PICKUP_COLLECT');
  if (order.status === 'DELIVERED') fail('ALREADY_DELIVERED', `Order ${order.id} is already delivered.`);
  if (order.status !== 'AWAITING_CUSTOMER_VERIFICATION' || !order.verification) fail('NOT_VERIFIED', 'The customer hasn’t confirmed their clothes yet.');
  if (openIssueFor(s, order.id)) fail('ISSUE_OPEN', 'There’s an open issue on this order.');
  consumeQr(s, ctx, input.qrId, { orderId: order.id, purpose: 'CUSTOMER_DELIVERY_VERIFICATION', staffId: input.staffId });
  const actor = actorForStaff(s, input.staffId);
  order.deliveredBy = input.staffId;
  order.deliveredAt = ctx.now;
  transition(s, ctx, order, 'DELIVERED', actor, order.serviceMode === 'HOME_PICKUP' ? `Delivered by ${actor.name}` : `Collected; confirmed by ${actor.name}`);
  notify(s, ctx, 'customer', order.customerId, 'DELIVERED', `${order.id} delivered`, `All ${order.pieces} pieces handed over. Thank you for choosing Washing Basket!`, order.id);
  return order;
}

/** A supervisor gives an open order to one staff member at the branch, or (staffId null) back to everyone. */
export function assignOrder(s: MockState, ctx: OpContext, input: { orderId: string; supervisorId: string; staffId: string | null }) {
  const order = staffOrder(s, input.orderId);
  const boss = assertStaff(s, input.supervisorId, order, 'ORDER_ASSIGN');
  if (isTerminal(order.status)) fail('BAD_STATE', `Order ${order.id} is closed.`);
  const actor = actorForStaff(s, boss.id);
  if (input.staffId === null) {
    if (!order.assignedTo) return order;
    order.assignedTo = undefined;
    order.assignedBy = undefined;
    order.assignedAt = undefined;
    order.updatedAt = ctx.now;
    logActivity(s, ctx, order, 'ASSIGNED', actor, `Assignment cleared by ${actor.name}`);
    return order;
  }
  const to = findStaff(s, input.staffId);
  if (!to || to.locationId !== order.locationId) return fail('NO_STAFF', 'Choose someone at this branch.');
  if (to.status !== 'ACTIVE') fail('SUSPENDED', `${to.name}’s account is paused.`);
  if (order.assignedTo === to.id) fail('ALREADY_ASSIGNED', `${order.id} is already assigned to ${to.name}.`);
  order.assignedTo = to.id;
  order.assignedBy = boss.id;
  order.assignedAt = ctx.now;
  order.updatedAt = ctx.now;
  logActivity(s, ctx, order, 'ASSIGNED', actor, `Assigned to ${to.name} by ${actor.name}`);
  return order;
}

/**
 * Staff flag damaged or missing items while the order is with them. The order can carry on through processing, but
 * it can't be handed over until an admin resolves the issue in the portal.
 */
export function reportStaffIssue(
  s: MockState,
  ctx: OpContext,
  input: { orderId: string; staffId: string; kind: IssueKind; note: string; counts?: Record<string, number> },
) {
  const order = staffOrder(s, input.orderId);
  assertStaff(s, input.staffId, order, 'ISSUE_REPORT');
  if (!['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY'].includes(order.status)) fail('BAD_STATE', 'Issues can be flagged while the order is with the branch.');
  if (openIssueFor(s, order.id)) fail('ISSUE_OPEN', 'This order already has an open issue.');
  const counts = input.counts ?? {};
  const mismatches = order.lines
    .filter((l) => counts[l.itemId] !== undefined && counts[l.itemId] !== l.qty)
    .map((l) => ({ itemId: l.itemId, name: l.name, expected: l.qty, received: counts[l.itemId] }));
  const note = input.note.trim();
  if (note.length < 5) fail('NO_DETAIL', 'Describe the problem in a few words.');
  const actor = actorForStaff(s, input.staffId);
  order.updatedAt = ctx.now;
  const issue = { id: `iss-${nextNumber(s, 'issue')}`, orderId: order.id, customerId: order.customerId, kind: input.kind, mismatches, note, status: 'OPEN' as const, source: 'staff' as const, reportedBy: input.staffId, reportedAt: ctx.now };
  s.issues.unshift(issue);
  const summary = mismatches.length ? `${mismatches.map((m) => `${m.name} ${m.received}/${m.expected}`).join(', ')} · ${note}` : note;
  logActivity(s, ctx, order, 'ISSUE_REPORTED', actor, `Issue flagged by ${actor.name}: ${summary}`);
  notify(s, ctx, 'admin', 'admin', 'ISSUE_REPORTED', `Staff flagged ${order.id}`, summary, order.id);
  notify(s, ctx, 'staff', order.locationId, 'ISSUE_REPORTED', `Issue on ${order.id}`, summary, order.id);
  return issue;
}

/* ───────────── Admin ───────────── */

export function resolveIssue(s: MockState, ctx: OpContext, input: { issueId: string; resolution: string; adminName: string }) {
  const issue = s.issues.find((i) => i.id === input.issueId);
  if (!issue) return fail('NO_ISSUE', 'Issue not found.');
  if (issue.status !== 'OPEN') fail('ALREADY_RESOLVED', 'This issue is already resolved.');
  if (input.resolution.trim().length < 3) fail('NO_RESOLUTION', 'Say how it was resolved.');
  issue.status = 'RESOLVED';
  issue.resolvedAt = ctx.now;
  issue.resolvedBy = input.adminName;
  issue.resolution = input.resolution.trim();
  const order = findOrder(s, issue.orderId);
  if (order) {
    order.updatedAt = ctx.now;
    logActivity(s, ctx, order, 'ISSUE_RESOLVED', { kind: 'admin', id: 'admin', name: input.adminName }, `Issue resolved: ${issue.resolution}`);
    notify(s, ctx, 'customer', order.customerId, 'ISSUE_RESOLVED', `Issue on ${order.id} resolved`, `${issue.resolution}. Please check your clothes again and confirm.`, order.id);
  }
  return issue;
}

export function setLocationStatus(s: MockState, input: { locationId: string; status: 'ACTIVE' | 'PAUSED' }) {
  const loc = findLocation(s, input.locationId);
  if (!loc) return fail('NO_LOCATION', 'Location not found.');
  loc.status = input.status;
  return loc;
}

export function setStaffStatus(s: MockState, input: { staffId: string; status: 'ACTIVE' | 'SUSPENDED' }) {
  const st = findStaff(s, input.staffId);
  if (!st) return fail('NO_STAFF', 'Staff not found.');
  st.status = input.status;
  return st;
}

/* ───────────── Small customer-side records ───────────── */

export function markReceiptAnimationShown(s: MockState, ctx: OpContext, input: { receiptId: string }) {
  const r = s.receipts.find((x) => x.id === input.receiptId);
  if (r && !r.animationShownAt) r.animationShownAt = ctx.now;
}

export function markNotificationsRead(s: MockState, ctx: OpContext, input: { ids: string[] }) {
  s.notifications.forEach((n) => {
    if (input.ids.includes(n.id) && !n.readAt) n.readAt = ctx.now;
  });
}

export type { QrPurpose };
