/** What a staff member can do next with an order, and doing it. Shared by the staff list and order screens. */
import type { IconName } from '../../components/app/Icon';
import { openIssueFor } from '../../mock/engine/selectors';
import * as staffService from '../../mock/services/staffService';
import type { LaundryOrder, MockState, Staff, StaffPermission } from '../../mock/types';

export type StaffAction =
  | { kind: 'scan-intake'; label: string; icon: IconName }
  | { kind: 'process'; label: string; icon: IconName }
  | { kind: 'ready'; label: string; icon: IconName }
  | { kind: 'handover'; label: string; icon: IconName }
  | { kind: 'scan-delivery'; label: string; icon: IconName };

const can = (st: Staff, p: StaffPermission) => st.permissions.includes(p);

export function nextAction(s: MockState, o: LaundryOrder, st: Staff): StaffAction | null {
  if (st.status !== 'ACTIVE' || st.locationId !== o.locationId) return null;
  switch (o.status) {
    case 'AWAITING_STAFF_ACCEPTANCE':
      if (!can(st, 'ORDER_ACCEPT') || (o.serviceMode === 'HOME_PICKUP' && !can(st, 'PICKUP_COLLECT'))) return null;
      return { kind: 'scan-intake', label: o.serviceMode === 'HOME_PICKUP' ? 'Scan pickup QR' : 'Scan to accept', icon: 'grid' };
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return can(st, 'ORDER_PROCESS') ? { kind: 'process', label: 'Start processing', icon: 'droplet' } : null;
    case 'PROCESSING':
      return can(st, 'ORDER_PROCESS') ? { kind: 'ready', label: 'Mark ready', icon: 'package' } : null;
    case 'READY_FOR_DELIVERY':
      return can(st, 'DELIVERY_CONFIRM') && !openIssueFor(s, o.id) ? { kind: 'handover', label: 'Hand over for checking', icon: 'shirt' } : null;
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return can(st, 'DELIVERY_CONFIRM') && o.verification && !openIssueFor(s, o.id) ? { kind: 'scan-delivery', label: 'Scan delivery QR', icon: 'grid' } : null;
    default:
      return null;
  }
}

/** Runs a non-scan action. Scans are started by the caller (they open the scanner). */
export async function runAction(kind: 'process' | 'ready' | 'handover', orderId: string, staffId: string) {
  if (kind === 'process') return staffService.startProcessing(orderId, staffId);
  if (kind === 'ready') return staffService.markReady(orderId, staffId);
  return staffService.handOver(orderId, staffId);
}

/** Where an order stands, in staff words. */
export function staffHint(s: MockState, o: LaundryOrder): string {
  if (openIssueFor(s, o.id)) return 'Customer reported an issue';
  switch (o.status) {
    case 'PAYMENT_PENDING':
      return 'Waiting for the customer to pay';
    case 'AWAITING_STAFF_ACCEPTANCE':
      return o.serviceMode === 'HOME_PICKUP' ? `Pickup ${o.pickup ? `· ${o.pickup.slotLabel}` : ''}` : 'Customer will show their QR at the counter';
    case 'READY_FOR_DELIVERY':
      return o.serviceMode === 'HOME_PICKUP' ? 'Ready to take to the customer' : 'Ready for collection';
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return o.verification ? 'Customer confirmed: scan their delivery QR' : 'Customer is checking the clothes';
    default:
      return '';
  }
}
