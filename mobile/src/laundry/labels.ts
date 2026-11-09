/** Display words and colours for the laundry system, in the app's own status tones. */
import { TONES, type Tone } from '../components/app/status';
import type { StatusTone } from '../mock/engine/lifecycle';
import type { NotificationKind, StaffRole } from '../mock/types';
import type { IconName } from '../components/app/Icon';

export const TONE: Record<StatusTone, Tone> = {
  waiting: TONES.waiting,
  progress: TONES.progress,
  done: TONES.done,
  stopped: TONES.stopped,
  muted: TONES.muted,
};

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  COUNTER_STAFF: 'Counter staff',
  PROCESSING_STAFF: 'Processing staff',
  PICKUP_AGENT: 'Pickup & delivery agent',
  LOCATION_MANAGER: 'Branch supervisor',
};

export const NOTIFICATION_LOOK: Record<NotificationKind, { icon: IconName; tone: StatusTone }> = {
  ORDER_SUBMITTED: { icon: 'receipt', tone: 'waiting' },
  PAYMENT_COMPLETED: { icon: 'wallet', tone: 'done' },
  PAYMENT_FAILED: { icon: 'alert', tone: 'stopped' },
  NEW_REQUEST: { icon: 'bag', tone: 'progress' },
  ORDER_ACCEPTED: { icon: 'check', tone: 'done' },
  ORDER_REJECTED: { icon: 'x', tone: 'stopped' },
  REFUND_ISSUED: { icon: 'refresh', tone: 'progress' },
  ORDER_CANCELLED: { icon: 'x', tone: 'muted' },
  PROCESSING: { icon: 'droplet', tone: 'progress' },
  READY: { icon: 'package', tone: 'done' },
  VERIFY_CLOTHES: { icon: 'shirt', tone: 'waiting' },
  DELIVERY_QR_READY: { icon: 'shield', tone: 'progress' },
  DELIVERED: { icon: 'truck', tone: 'done' },
  ISSUE_REPORTED: { icon: 'alert', tone: 'stopped' },
  ISSUE_RESOLVED: { icon: 'check', tone: 'done' },
};
