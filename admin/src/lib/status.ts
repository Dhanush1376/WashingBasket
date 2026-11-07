/**
 * Status labels and colours. The wording and tones match the customer app's
 * (mobile/src/components/app/status.ts), so the team and the customer see the same words.
 */
import { app, colors } from '@customer/theme';
import type { CustomerStatus, NotificationType, OfferStatus, OrderStatus, PaymentStatus, RequestStatus, WalletTxnSource, WalletTxnType } from '@/types';
import type { IconName } from '@/components/ui/Icon';

export type Tone = { fg: string; bg: string };

export const TONES = {
  progress: { fg: colors.navy, bg: app.navySoft },
  waiting: { fg: app.warning, bg: app.warningTint },
  done: { fg: '#0D7A21', bg: colors.successTint },
  stopped: { fg: colors.danger, bg: colors.dangerTint },
  muted: { fg: colors.inkSoft, bg: '#EFEDE8' },
} as const;

type Labelled = { label: string; tone: Tone };

export const ORDER_STATUS: Record<OrderStatus, Labelled> = {
  pickup_scheduled: { label: 'Pickup scheduled', tone: TONES.waiting },
  collected: { label: 'Collected', tone: TONES.progress },
  washing: { label: 'Being washed', tone: TONES.progress },
  drying: { label: 'Drying', tone: TONES.progress },
  ironing: { label: 'Ironing', tone: TONES.progress },
  packing: { label: 'Packing', tone: TONES.progress },
  washing_drying: { label: 'Washing & Drying', tone: TONES.progress },
  ironing_packing: { label: 'Ironing & Packing', tone: TONES.progress },
  out_for_delivery: { label: 'Out for delivery', tone: TONES.progress },
  delivered: { label: 'Delivered', tone: TONES.done },
  cancelled: { label: 'Cancelled', tone: TONES.stopped },
};

/** What the button that moves an order on says, for each next step. */
export const NEXT_STEP_ACTION: Partial<Record<OrderStatus, string>> = {
  collected: 'Mark as collected',
  washing: 'Start washing',
  drying: 'Move to drying',
  ironing: 'Move to ironing',
  packing: 'Move to packing',
  out_for_delivery: 'Send out for delivery',
  delivered: 'Mark as delivered',
};

export const REQUEST_STATUS: Record<RequestStatus, Labelled> = {
  pending: { label: 'Needs confirming', tone: TONES.waiting },
  confirmed: { label: 'Confirmed', tone: TONES.progress },
  picked_up: { label: 'Picked up', tone: TONES.done },
  cancelled: { label: 'Cancelled', tone: TONES.stopped },
};

export const OFFER_STATUS: Record<OfferStatus, Labelled> = {
  active: { label: 'Running', tone: TONES.done },
  upcoming: { label: 'Starts soon', tone: TONES.waiting },
  expired: { label: 'Ended', tone: TONES.muted },
};

export const PAYMENT_STATUS: Record<PaymentStatus, Labelled> = {
  paid: { label: 'Paid', tone: TONES.done },
  pending: { label: 'Not paid yet', tone: TONES.waiting },
  not_charged: { label: 'Not charged', tone: TONES.muted },
};

export const CUSTOMER_STATUS: Record<CustomerStatus, Labelled> = {
  active: { label: 'Active', tone: TONES.done },
  paused: { label: 'Paused', tone: TONES.muted },
};

export const TICKET_STATUS = {
  open: { label: 'Waiting for reply', tone: TONES.waiting },
  resolved: { label: 'Resolved', tone: TONES.done },
} as const;

export const TXN_TYPE: Record<WalletTxnType, { label: string; sign: '+' | '−' }> = {
  credit: { label: 'Money in', sign: '+' },
  refund: { label: 'Refund', sign: '+' },
  debit: { label: 'Spent', sign: '−' },
};

export const TXN_SOURCE: Record<WalletTxnSource, { label: string; icon: IconName }> = {
  topup: { label: 'Added by customer', icon: 'plus' },
  referral: { label: 'Referral reward', icon: 'gift' },
  bonus: { label: 'Bonus', icon: 'sparkle' },
  order: { label: 'Paid for order', icon: 'bag' },
  refund: { label: 'Refund', icon: 'refresh' },
};

export const TXN_STATUS = {
  completed: { label: 'Completed', tone: TONES.done },
  pending: { label: 'Pending', tone: TONES.waiting },
} as const;

export const NOTIFICATION_TYPE: Record<NotificationType, { label: string; icon: IconName }> = {
  order: { label: 'Order update', icon: 'droplet' },
  pickup: { label: 'Pickup', icon: 'calendar' },
  delivery: { label: 'Delivery', icon: 'truck' },
  account: { label: 'Account & news', icon: 'user' },
};

export const REFERRAL_STATUS = {
  invited: { label: 'Invited', tone: TONES.muted },
  joined: { label: 'Joined, reward waiting', tone: TONES.waiting },
  rewarded: { label: 'Reward paid', tone: TONES.done },
} as const;
