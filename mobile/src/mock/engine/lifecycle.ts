/**
 * The order lifecycle: one state machine for every order, with only the steps that apply to its service mode.
 *
 *   office drop-off   REQUEST_SUBMITTED → PAYMENT_PENDING → PAYMENT_COMPLETED → AWAITING_STAFF_ACCEPTANCE → ACCEPTED
 *                     → PROCESSING → READY_FOR_DELIVERY → AWAITING_CUSTOMER_VERIFICATION → DELIVERED
 *   home pickup       … → ACCEPTED → PICKUP_CONFIRMED → PROCESSING → …   (the agent collects at the door)
 *
 * Terminal alternatives: REJECTED (staff), CANCELLED (customer, before acceptance). REFUND_PENDING and REFUNDED are
 * kept in the model for future partial refunds; today a rejection or cancellation reverses the payment at once and
 * the payment itself carries status REVERSED.
 */
import type { LaundryOrder, OrderStatus, PaymentStatus, QrPurpose, ServiceMode } from '../types.ts';

const ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  REQUEST_SUBMITTED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_COMPLETED', 'CANCELLED'],
  PAYMENT_COMPLETED: ['AWAITING_STAFF_ACCEPTANCE'],
  AWAITING_STAFF_ACCEPTANCE: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PICKUP_CONFIRMED', 'PROCESSING'],
  PICKUP_CONFIRMED: ['PROCESSING'],
  PROCESSING: ['READY_FOR_DELIVERY'],
  READY_FOR_DELIVERY: ['AWAITING_CUSTOMER_VERIFICATION'],
  AWAITING_CUSTOMER_VERIFICATION: ['DELIVERED'],
};

/** Steps that exist only for one service mode. */
const MODE_ONLY: Partial<Record<OrderStatus, ServiceMode>> = { PICKUP_CONFIRMED: 'HOME_PICKUP' };

export function canTransition(order: Pick<LaundryOrder, 'status' | 'serviceMode'>, to: OrderStatus): boolean {
  if (!(ALLOWED[order.status] ?? []).includes(to)) return false;
  const only = MODE_ONLY[to];
  if (only && only !== order.serviceMode) return false;
  // a home pickup must be collected before it can be processed
  if (order.serviceMode === 'HOME_PICKUP' && order.status === 'ACCEPTED' && to === 'PROCESSING') return false;
  return true;
}

export const TERMINAL: OrderStatus[] = ['DELIVERED', 'REJECTED', 'CANCELLED', 'REFUNDED'];
export const isTerminal = (s: OrderStatus) => TERMINAL.includes(s);
export const isOpen = (s: OrderStatus) => !isTerminal(s);

/** The steps a customer sees on their timeline, for this mode, in order. */
export function journeyFor(mode: ServiceMode): OrderStatus[] {
  return mode === 'HOME_PICKUP'
    ? ['REQUEST_SUBMITTED', 'PAYMENT_COMPLETED', 'AWAITING_STAFF_ACCEPTANCE', 'ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED']
    : ['REQUEST_SUBMITTED', 'PAYMENT_COMPLETED', 'AWAITING_STAFF_ACCEPTANCE', 'ACCEPTED', 'PROCESSING', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED'];
}

/** Where an order is on its journey (PAYMENT_PENDING sits on the payment step). */
export function journeyIndex(order: Pick<LaundryOrder, 'status' | 'serviceMode'>): number {
  const steps = journeyFor(order.serviceMode);
  const s = order.status === 'PAYMENT_PENDING' ? 'PAYMENT_COMPLETED' : order.status;
  return steps.indexOf(s);
}

export type StatusTone = 'waiting' | 'progress' | 'done' | 'stopped' | 'muted';

type StatusCopy = { label: string; tone: StatusTone; customer: Record<ServiceMode, string> };

/** Words for every status: a short label, and what it means for the customer in each mode. */
export const STATUS_COPY: Record<OrderStatus, StatusCopy> = {
  REQUEST_SUBMITTED: { label: 'Request submitted', tone: 'waiting', customer: { OFFICE_DROP_OFF: 'We have your request.', HOME_PICKUP: 'We have your pickup request.' } },
  PAYMENT_PENDING: { label: 'Payment pending', tone: 'waiting', customer: { OFFICE_DROP_OFF: 'Pay from your wallet to unlock your QR code.', HOME_PICKUP: 'Pay from your wallet to unlock your pickup QR code.' } },
  PAYMENT_COMPLETED: { label: 'Payment completed', tone: 'progress', customer: { OFFICE_DROP_OFF: 'Paid from your wallet. Your QR is unlocked.', HOME_PICKUP: 'Paid from your wallet. Your pickup QR is unlocked.' } },
  AWAITING_STAFF_ACCEPTANCE: { label: 'Awaiting acceptance', tone: 'waiting', customer: { OFFICE_DROP_OFF: 'Show your QR at the counter. Our staff will check your clothes.', HOME_PICKUP: 'Our pickup partner will scan your QR at your door.' } },
  ACCEPTED: { label: 'Accepted', tone: 'progress', customer: { OFFICE_DROP_OFF: 'Our staff checked your clothes and accepted the order.', HOME_PICKUP: 'Our pickup partner accepted your order.' } },
  PICKUP_CONFIRMED: { label: 'Picked up', tone: 'progress', customer: { OFFICE_DROP_OFF: '', HOME_PICKUP: 'Your laundry is on its way to our store.' } },
  PROCESSING: { label: 'Processing', tone: 'progress', customer: { OFFICE_DROP_OFF: 'Your clothes are being washed and finished.', HOME_PICKUP: 'Your clothes are being washed and finished.' } },
  READY_FOR_DELIVERY: { label: 'Ready', tone: 'progress', customer: { OFFICE_DROP_OFF: 'Ready for collection at the office.', HOME_PICKUP: 'Ready, and on its way back to you.' } },
  AWAITING_CUSTOMER_VERIFICATION: { label: 'Checking clothes', tone: 'waiting', customer: { OFFICE_DROP_OFF: 'Check your clothes, then show your delivery QR.', HOME_PICKUP: 'Check your clothes, then show your delivery QR.' } },
  DELIVERED: { label: 'Delivered', tone: 'done', customer: { OFFICE_DROP_OFF: 'Collected. Thank you!', HOME_PICKUP: 'Delivered to your door. Thank you!' } },
  REJECTED: { label: 'Rejected', tone: 'stopped', customer: { OFFICE_DROP_OFF: 'Our staff couldn’t accept this order.', HOME_PICKUP: 'Our pickup partner couldn’t accept this order.' } },
  CANCELLED: { label: 'Cancelled', tone: 'stopped', customer: { OFFICE_DROP_OFF: 'You cancelled this request.', HOME_PICKUP: 'You cancelled this pickup.' } },
  REFUND_PENDING: { label: 'Refund pending', tone: 'waiting', customer: { OFFICE_DROP_OFF: 'Your refund is on its way.', HOME_PICKUP: 'Your refund is on its way.' } },
  REFUNDED: { label: 'Refunded', tone: 'muted', customer: { OFFICE_DROP_OFF: 'Refunded to your wallet.', HOME_PICKUP: 'Refunded to your wallet.' } },
};

/** Timeline titles, which read better than status labels in a journey. */
export const JOURNEY_TITLE: Record<ServiceMode, Partial<Record<OrderStatus, string>>> = {
  OFFICE_DROP_OFF: {
    REQUEST_SUBMITTED: 'Request submitted',
    PAYMENT_COMPLETED: 'Payment',
    AWAITING_STAFF_ACCEPTANCE: 'Show your QR at the counter',
    ACCEPTED: 'Accepted by staff',
    PROCESSING: 'Washing & finishing',
    READY_FOR_DELIVERY: 'Ready for collection',
    AWAITING_CUSTOMER_VERIFICATION: 'You check your clothes',
    DELIVERED: 'Collected',
  },
  HOME_PICKUP: {
    REQUEST_SUBMITTED: 'Pickup requested',
    PAYMENT_COMPLETED: 'Payment',
    AWAITING_STAFF_ACCEPTANCE: 'Show your QR to the partner',
    ACCEPTED: 'Accepted by partner',
    PICKUP_CONFIRMED: 'Picked up',
    PROCESSING: 'Washing & finishing',
    READY_FOR_DELIVERY: 'Out for delivery',
    AWAITING_CUSTOMER_VERIFICATION: 'You check your clothes',
    DELIVERED: 'Delivered',
  },
};

export const PAYMENT_COPY: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  REQUIRED: { label: 'Payment required', tone: 'waiting' },
  COMPLETED: { label: 'Payment completed', tone: 'done' },
  FAILED: { label: 'Payment failed', tone: 'stopped' },
  REVERSED: { label: 'Payment reversed', tone: 'muted' },
};

export const MODE_COPY: Record<ServiceMode, { label: string; short: string; description: string }> = {
  OFFICE_DROP_OFF: { label: 'Office drop-off', short: 'Drop-off', description: 'Bring your laundry to our office and collect it when it’s ready.' },
  HOME_PICKUP: { label: 'Home pickup & delivery', short: 'Home pickup', description: 'Our partner collects from your door and brings it back.' },
};

export const QR_PURPOSE_COPY: Record<QrPurpose, { label: string; code: string }> = {
  ORDER_SUBMISSION: { label: 'Laundry submission', code: 'SUB' },
  PICKUP_COLLECTION: { label: 'Pickup collection', code: 'PCK' },
  CUSTOMER_DELIVERY_VERIFICATION: { label: 'Delivery verification', code: 'DLV' },
};

/** Which QR purpose starts an order of this mode. */
export const intakePurpose = (mode: ServiceMode): QrPurpose => (mode === 'HOME_PICKUP' ? 'PICKUP_COLLECTION' : 'ORDER_SUBMISSION');

/** Coarse groups for dashboards and filters. */
export type StatusGroup = 'pending' | 'accepted' | 'processing' | 'ready' | 'delivered' | 'rejected' | 'cancelled';

export function statusGroup(s: OrderStatus): StatusGroup {
  switch (s) {
    case 'REQUEST_SUBMITTED':
    case 'PAYMENT_PENDING':
    case 'PAYMENT_COMPLETED':
    case 'AWAITING_STAFF_ACCEPTANCE':
      return 'pending';
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return 'accepted';
    case 'PROCESSING':
      return 'processing';
    case 'READY_FOR_DELIVERY':
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return 'ready';
    case 'DELIVERED':
      return 'delivered';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'cancelled';
  }
}

export const GROUP_COPY: Record<StatusGroup, string> = {
  pending: 'Pending requests',
  accepted: 'Accepted',
  processing: 'Processing',
  ready: 'Ready',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
