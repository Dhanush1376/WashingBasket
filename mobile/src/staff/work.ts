/**
 * The staff app's view of work: what each role focuses on, the next step a staff member can take on an order, and
 * the task list built from those steps. Pure functions over the shared laundry state.
 *
 * The UI only *offers* a step here; the engine (src/mock/engine/ops.ts) checks every rule again when the step runs,
 * so a button that slips through can never break an order.
 */
import type { IconName } from '../components/app/Icon';
import { isOpen, MODE_COPY, nextStage, STAGE_COPY } from '../mock/engine/lifecycle';
import { findCustomer, findLocation, findStaff, openIssueFor } from '../mock/engine/selectors';
import type { LaundryOrder, MockState, ProcessingStage, Staff, StaffPermission, StaffRole } from '../mock/types';

export const can = (st: Staff, p: StaffPermission) => st.permissions.includes(p);
export const isSupervisor = (st: Staff) => can(st, 'ORDER_ASSIGN');

/* ───────────── roles ───────────── */

export type OrdersFilter = 'all' | 'incoming' | 'assigned' | 'progress' | 'ready' | 'completed';

type RoleLook = {
  /** What the Home header calls the job. */
  title: string;
  /** The orders this role works on (others at the branch are still viewable from All). */
  focus: (o: LaundryOrder) => boolean;
  /** The Orders tab's filters, in order, and the one it opens on. */
  filters: OrdersFilter[];
  start: OrdersFilter;
  /** Home's quick actions, in order, in this role's words. */
  quick: { id: QuickActionId; label: string }[];
};

export type QuickActionId = 'scan' | 'incoming' | 'progress' | 'ready' | 'assigned';

const counterFocus = (o: LaundryOrder) => o.serviceMode === 'OFFICE_DROP_OFF';
const processingFocus = (o: LaundryOrder) => ['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING'].includes(o.status);
const deliveryFocus = (o: LaundryOrder) => o.serviceMode === 'HOME_PICKUP';

export const ROLE: Record<StaffRole, RoleLook> = {
  COUNTER_STAFF: {
    title: 'Counter',
    focus: counterFocus,
    filters: ['all', 'incoming', 'progress', 'ready', 'completed'],
    start: 'incoming',
    quick: [
      { id: 'scan', label: 'Scan QR' },
      { id: 'incoming', label: 'Incoming' },
      { id: 'progress', label: 'In progress' },
      { id: 'ready', label: 'Handover' },
    ],
  },
  PROCESSING_STAFF: {
    title: 'Wash floor',
    focus: processingFocus,
    filters: ['progress', 'assigned', 'ready', 'all'],
    start: 'progress',
    quick: [
      { id: 'progress', label: 'Update status' },
      { id: 'assigned', label: 'Assigned' },
      { id: 'ready', label: 'Ready' },
    ],
  },
  PICKUP_AGENT: {
    title: 'Pickups & deliveries',
    focus: deliveryFocus,
    filters: ['all', 'incoming', 'assigned', 'progress', 'ready', 'completed'],
    start: 'incoming',
    quick: [
      { id: 'scan', label: 'Scan QR' },
      { id: 'incoming', label: 'Pickups' },
      { id: 'ready', label: 'Deliveries' },
      { id: 'assigned', label: 'Assigned' },
    ],
  },
  LOCATION_MANAGER: {
    title: 'Branch',
    focus: () => true,
    filters: ['all', 'incoming', 'assigned', 'progress', 'ready', 'completed'],
    start: 'all',
    quick: [
      { id: 'scan', label: 'Scan QR' },
      { id: 'incoming', label: 'Incoming' },
      { id: 'progress', label: 'Wash floor' },
      { id: 'ready', label: 'Ready' },
    ],
  },
};

export const FILTER_LABEL: Record<OrdersFilter, string> = {
  all: 'All',
  incoming: 'Incoming',
  assigned: 'Assigned',
  progress: 'In progress',
  ready: 'Ready',
  completed: 'Completed',
};

const today = () => new Date().toISOString().slice(0, 10);

export function matchesFilter(o: LaundryOrder, f: OrdersFilter, st: Staff): boolean {
  switch (f) {
    case 'incoming':
      return o.status === 'AWAITING_STAFF_ACCEPTANCE';
    case 'assigned':
      // a supervisor sees everything they've handed out; everyone else, what's been handed to them
      return isOpen(o.status) && (isSupervisor(st) ? !!o.assignedTo : o.assignedTo === st.id);
    case 'progress':
      return ['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING'].includes(o.status);
    case 'ready':
      return o.status === 'READY_FOR_DELIVERY' || o.status === 'AWAITING_CUSTOMER_VERIFICATION';
    case 'completed':
      return o.status === 'DELIVERED' || o.status === 'REJECTED';
    default:
      return o.status !== 'PAYMENT_PENDING' && o.status !== 'REQUEST_SUBMITTED' && o.status !== 'CANCELLED';
  }
}

/** Orders at the staff member's own branch, newest activity first. Unpaid requests aren't staff work yet. */
export function branchOrders(s: MockState, st: Staff): LaundryOrder[] {
  return s.orders.filter((o) => o.locationId === st.locationId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/* ───────────── the next step on an order ───────────── */

export type StaffAction =
  | { kind: 'scan-intake'; label: string; icon: IconName }
  | { kind: 'process'; label: string; icon: IconName }
  | { kind: 'stage'; to: ProcessingStage; label: string; icon: IconName }
  | { kind: 'ready'; label: string; icon: IconName }
  | { kind: 'handover'; label: string; icon: IconName }
  | { kind: 'scan-delivery'; label: string; icon: IconName };

export const STAGE_ICON: Record<ProcessingStage, IconName> = {
  SORTING: 'sliders',
  WASHING: 'droplet',
  DRYING: 'wind',
  IRONING: 'shirt',
  QUALITY_CHECK: 'shield',
};

/** Whether someone else holds this order (a supervisor can still act on it). */
export const heldByOther = (o: LaundryOrder, st: Staff) => !!o.assignedTo && o.assignedTo !== st.id && !isSupervisor(st);

export function nextAction(s: MockState, o: LaundryOrder, st: Staff): StaffAction | null {
  if (st.status !== 'ACTIVE' || st.locationId !== o.locationId || heldByOther(o, st)) return null;
  const home = o.serviceMode === 'HOME_PICKUP';
  switch (o.status) {
    case 'AWAITING_STAFF_ACCEPTANCE':
      if (!can(st, 'ORDER_ACCEPT') || (home && !can(st, 'PICKUP_COLLECT'))) return null;
      return { kind: 'scan-intake', label: home ? 'Scan pickup QR' : 'Scan to accept', icon: 'scan' };
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return can(st, 'ORDER_PROCESS') ? { kind: 'process', label: 'Start sorting', icon: 'sliders' } : null;
    case 'PROCESSING': {
      if (!can(st, 'ORDER_PROCESS')) return null;
      const to = nextStage(o.processingStage);
      return to ? { kind: 'stage', to, label: STAGE_COPY[to].action, icon: STAGE_ICON[to] } : { kind: 'ready', label: 'Ready for dispatch', icon: 'package' };
    }
    case 'READY_FOR_DELIVERY':
      if (!can(st, 'DELIVERY_CONFIRM') || (home && !can(st, 'PICKUP_COLLECT')) || openIssueFor(s, o.id)) return null;
      return { kind: 'handover', label: home ? 'Hand over at the door' : 'Hand over for checking', icon: 'shirt' };
    case 'AWAITING_CUSTOMER_VERIFICATION':
      if (!can(st, 'DELIVERY_CONFIRM') || (home && !can(st, 'PICKUP_COLLECT')) || !o.verification || openIssueFor(s, o.id)) return null;
      return { kind: 'scan-delivery', label: 'Scan delivery QR', icon: 'scan' };
    default:
      return null;
  }
}

/** Which kinds of step belong on a role's own task list (others stay reachable from the order). */
const TASK_KINDS: Record<StaffRole, StaffAction['kind'][]> = {
  COUNTER_STAFF: ['scan-intake', 'handover', 'scan-delivery'],
  PROCESSING_STAFF: ['process', 'stage', 'ready'],
  PICKUP_AGENT: ['scan-intake', 'handover', 'scan-delivery'],
  LOCATION_MANAGER: ['scan-intake', 'process', 'stage', 'ready', 'handover', 'scan-delivery'],
};

/** Where an order stands, in staff words, when there's no step for this person to take. */
export function waitingOn(s: MockState, o: LaundryOrder, st: Staff): string {
  if (openIssueFor(s, o.id)) return 'Open issue: waiting for the admin team';
  if (o.assignedTo && o.assignedTo !== st.id) return `Assigned to ${findStaff(s, o.assignedTo)?.name ?? 'a colleague'}`;
  switch (o.status) {
    case 'PAYMENT_PENDING':
      return 'Waiting for the customer to pay';
    case 'AWAITING_STAFF_ACCEPTANCE':
      return o.serviceMode === 'HOME_PICKUP' ? `Pickup ${o.pickup ? `· ${o.pickup.slotLabel}` : ''}` : 'Customer will show their QR at the counter';
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return 'Received: waiting for the wash floor';
    case 'PROCESSING':
      return `On the wash floor · ${STAGE_COPY[o.processingStage ?? 'WASHING'].label}`;
    case 'READY_FOR_DELIVERY':
      return o.serviceMode === 'HOME_PICKUP' ? 'Ready to take to the customer' : 'Ready for collection';
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return o.verification ? 'Customer confirmed: scan their delivery QR' : 'Customer is checking the clothes';
    case 'DELIVERED':
      return o.serviceMode === 'HOME_PICKUP' ? 'Delivered' : 'Collected';
    case 'REJECTED':
      return `Rejected · ${o.rejectionReason ?? ''}`;
    default:
      return MODE_COPY[o.serviceMode].label;
  }
}

/* ───────────── tasks ───────────── */

/** Promised turnaround from acceptance to ready (the customer app's "48h turnaround"). */
export const TURNAROUND_HOURS = 48;

export type Task = {
  order: LaundryOrder;
  action: StaffAction;
  customerName: string;
  /** "Due 4:00 PM", "Overdue by 3h", "Slot 8:00 – 10:00 AM" */
  due: string;
  urgent: boolean;
  /** For sorting: earlier first. */
  dueAt: number;
};

function dueFor(s: MockState, o: LaundryOrder, now: number): { label: string; at: number; urgent: boolean } {
  if (o.status === 'AWAITING_STAFF_ACCEPTANCE' && o.pickup) {
    const slot = findLocation(s, o.locationId)?.homePickup?.slots.find((x) => x.id === o.pickup!.slotId);
    const at = Date.parse(`${o.pickup.date}T00:00:00`) + (slot?.startHour ?? 9) * 3600_000;
    const day = o.pickup.date === today() ? 'Today' : new Date(`${o.pickup.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return { label: `${day} · ${o.pickup.slotLabel}`, at, urgent: o.pickup.date <= today() };
  }
  if (['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING'].includes(o.status) && o.acceptedAt) {
    const at = Date.parse(o.acceptedAt) + TURNAROUND_HOURS * 3600_000;
    const left = Math.round((at - now) / 3600_000);
    if (left < 0) return { label: `Overdue by ${-left}h`, at, urgent: true };
    return { label: left < 24 ? `Due in ${left}h` : `Due ${new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`, at, urgent: left < 6 };
  }
  const waiting = Math.round((now - Date.parse(o.updatedAt)) / 3600_000);
  return { label: waiting < 1 ? 'Just now' : `Waiting ${waiting}h`, at: Date.parse(o.updatedAt), urgent: waiting >= 24 };
}

/** The staff member's own pending steps, most pressing first. */
export function tasksFor(s: MockState, st: Staff, now = Date.now()): Task[] {
  const kinds = TASK_KINDS[st.role];
  return branchOrders(s, st)
    .flatMap((o): Task[] => {
      const action = nextAction(s, o, st);
      if (!action || !kinds.includes(action.kind)) return [];
      const d = dueFor(s, o, now);
      return [{ order: o, action, customerName: findCustomer(s, o.customerId)?.name ?? 'Customer', due: d.label, urgent: d.urgent || o.assignedTo === st.id, dueAt: d.at }];
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.dueAt - b.dueAt);
}

/** Today's work done by this person: status changes and stage steps they made since midnight. */
export function doneToday(s: MockState, st: Staff): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  return new Set(
    s.activities.filter((a) => a.actor.id === st.id && Date.parse(a.at) >= t && (a.type === 'STATUS_CHANGED' || a.type === 'STAGE_CHANGED')).map((a) => `${a.orderId}:${a.to ?? a.message}`),
  ).size;
}

/* ───────────── privacy ───────────── */

/** Customer contact is for the people who hand clothes over; the wash floor sees a first name and initial. */
export function canSeeContact(st: Staff, o: LaundryOrder) {
  if (st.role === 'PROCESSING_STAFF') return false;
  if (o.serviceMode === 'HOME_PICKUP') return can(st, 'PICKUP_COLLECT') || isSupervisor(st);
  return true;
}

export function displayName(name: string, full: boolean) {
  if (full) return name;
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

/** "+91 •••• •9248" */
export const maskPhone = (phone: string) => phone.replace(/\d(?=(?:\D*\d){4})/g, '•');

/* ───────────── supervisor ───────────── */

export type Workload = { staff: Staff; open: number; assigned: number };

/** Who at the branch is carrying how much open work. */
export function workload(s: MockState, st: Staff): Workload[] {
  const orders = branchOrders(s, st).filter((o) => isOpen(o.status));
  return s.staff
    .filter((x) => x.locationId === st.locationId && x.status === 'ACTIVE')
    .map((x) => ({
      staff: x,
      assigned: orders.filter((o) => o.assignedTo === x.id).length,
      open: orders.filter((o) => o.assignedTo === x.id || (!o.assignedTo && [o.acceptedBy, o.processingBy, o.readyBy, o.handoverBy].includes(x.id))).length,
    }))
    .sort((a, b) => b.open - a.open);
}

/** Things a supervisor should look at: open issues, refused scans today, and work past its turnaround. */
export function exceptions(s: MockState, st: Staff, now = Date.now()) {
  const orders = branchOrders(s, st);
  const issues = s.issues.filter((i) => i.status === 'OPEN' && orders.some((o) => o.id === i.orderId));
  const overdue = orders.filter((o) => ['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING'].includes(o.status) && o.acceptedAt && Date.parse(o.acceptedAt) + TURNAROUND_HOURS * 3600_000 < now);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const refused = s.activities.filter((a) => a.locationId === st.locationId && a.type === 'QR_REFUSED' && Date.parse(a.at) >= start.getTime());
  return { issues, overdue, refused };
}
