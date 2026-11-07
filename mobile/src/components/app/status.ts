import { app, colors } from '../../theme';
import type { NotificationType, OfferStatus, OrderStatus, RequestStatus } from '../../types/models';
import type { IconName } from './Icon';

export type Tone = { fg: string; bg: string };

const TONES = {
  progress: { fg: colors.navy, bg: app.navySoft },
  waiting: { fg: app.warning, bg: app.warningTint },
  done: { fg: '#0D7A21', bg: colors.successTint },
  stopped: { fg: colors.danger, bg: colors.dangerTint },
  muted: { fg: colors.inkSoft, bg: '#EFEDE8' },
} as const;

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  collected: { label: 'Drop-off & Collection', tone: TONES.progress },
  washing_drying: { label: 'Washing & Drying', tone: TONES.progress },
  ironing_packing: { label: 'Ironing & Packing', tone: TONES.progress },
  out_for_delivery: { label: 'Out for delivery', tone: TONES.progress },
  delivered: { label: 'Delivered', tone: TONES.done },
  cancelled: { label: 'Cancelled', tone: TONES.stopped },
  // legacy aliases
  pickup_scheduled: { label: 'Drop-off & Collection', tone: TONES.waiting },
  washing: { label: 'Washing & Drying', tone: TONES.progress },
  drying: { label: 'Washing & Drying', tone: TONES.progress },
  ironing: { label: 'Ironing & Packing', tone: TONES.progress },
  packing: { label: 'Ironing & Packing', tone: TONES.progress },
};

/** Short names for the 5-step journey. */
export const STAGE_LABEL: Record<Exclude<OrderStatus, 'cancelled'>, string> = {
  collected: 'Drop-off & Collection',
  washing_drying: 'Washing & Drying',
  ironing_packing: 'Ironing & Packing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  // legacy aliases
  pickup_scheduled: 'Drop-off & Collection',
  washing: 'Washing & Drying',
  drying: 'Washing & Drying',
  ironing: 'Ironing & Packing',
  packing: 'Ironing & Packing',
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Awaiting confirmation', tone: TONES.waiting },
  confirmed: { label: 'Confirmed', tone: TONES.progress },
  picked_up: { label: 'Picked up', tone: TONES.done },
  cancelled: { label: 'Cancelled', tone: TONES.stopped },
};

export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: TONES.done },
  upcoming: { label: 'Upcoming', tone: TONES.waiting },
  expired: { label: 'Expired', tone: TONES.muted },
};

export const NOTIFICATION_ICON: Record<NotificationType, IconName> = {
  order: 'droplet',
  pickup: 'calendar',
  delivery: 'truck',
  account: 'user',
};

export const TICKET_STATUS = {
  open: { label: 'Open', tone: TONES.waiting },
  resolved: { label: 'Resolved', tone: TONES.done },
} as const;

export { TONES };
