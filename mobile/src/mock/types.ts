/**
 * Laundry order system: the shared data model.
 *
 * MOCK DATA ONLY. These shapes describe the demo records in src/mock/data/*.json. The customer app, the staff
 * screens (inside the same app) and the admin portal all read and change ONE state of this shape through the
 * services in src/mock/services, so an order is never copied into three versions. A real backend should return
 * the same shapes so the screens don't change.
 *
 * This folder is plain TypeScript (no React Native imports), so the admin portal can import it too.
 */

export type ISO = string;

/* ───────────── Locations ───────────── */

export type ServiceMode = 'OFFICE_DROP_OFF' | 'HOME_PICKUP';
export type LocationType = 'CAMPUS_OFFICE' | 'INDEPENDENT';
export type LocationStatus = 'ACTIVE' | 'PAUSED';

/** `startHour` (0–23, local time): a slot can't be booked for today once it has started. */
export type PickupSlotDef = { id: string; label: string; period: 'Morning' | 'Afternoon' | 'Evening'; startHour: number };

export type Location = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  city: string;
  type: LocationType;
  /** Demo PIN code that routes a customer (or staff member) to this location. */
  pincode: string;
  status: LocationStatus;
  serviceModes: ServiceMode[];
  description: string;
  office: { name: string; address: string; hours: string; phone: string };
  /** Only where HOME_PICKUP is offered. */
  homePickup?: { areaNote: string; daysAhead: number; slots: PickupSlotDef[] };
  sortOrder: number;
};

/* ───────────── Price list ───────────── */

export type GarmentIcon =
  | 'shirt'
  | 'tshirt'
  | 'trousers'
  | 'jeans'
  | 'shorts'
  | 'kurta'
  | 'bedsheet'
  | 'towel'
  | 'pillow'
  | 'jacket'
  | 'saree'
  | 'dress'
  | 'sweater'
  | 'innerwear'
  | 'socks'
  | 'curtain'
  | 'toy'
  | 'blanket'
  | 'shoe'
  | 'bag'
  | 'stain'
  | 'dye'
  | 'wash';

export type CatalogItem = {
  id: string;
  name: string;
  icon: GarmentIcon;
  unit: 'piece' | 'pair' | 'kg';
  price: number;
  /** 'printed-list': the price comes from the business's printed price list. 'illustrative': demo price. */
  priceSource: 'printed-list' | 'illustrative';
  note?: string;
};

export type CatalogCategory = { id: string; name: string; description: string; items: CatalogItem[] };

export type ServiceCharge = { fee: number; freeAbove?: number; label: string };

export type Catalog = {
  currency: 'INR';
  note: string;
  illustrativeNote: string;
  serviceCharges: Record<ServiceMode, ServiceCharge>;
  categories: CatalogCategory[];
};

/* ───────────── People ───────────── */

export type Customer = {
  id: string;
  name: string;
  /** Display phone, e.g. "+91 93474 89248". */
  phone: string;
  /** Sign-in key: the phone's digits, or "social:<id>" for Google/Apple demo sign-ins. */
  authKey: string;
  email?: string;
  homeLocationId?: string;
  createdAt: ISO;
  status: 'ACTIVE' | 'PAUSED';
};

/**
 * One staff app, four kinds of work. A role decides what the app shows; permissions decide what the engine allows.
 *   COUNTER_STAFF      the campus/store counter: accepts drop-offs, hands completed orders back
 *   PROCESSING_STAFF   the wash floor: moves orders through sorting, washing, drying, ironing and quality check
 *   PICKUP_AGENT       off-campus pickups and deliveries at the customer's door
 *   LOCATION_MANAGER   the branch supervisor: sees everything at the branch and assigns work
 */
export type StaffRole = 'COUNTER_STAFF' | 'PROCESSING_STAFF' | 'PICKUP_AGENT' | 'LOCATION_MANAGER';
export type StaffPermission = 'ORDER_ACCEPT' | 'ORDER_REJECT' | 'ORDER_PROCESS' | 'PICKUP_COLLECT' | 'DELIVERY_CONFIRM' | 'ORDER_ASSIGN' | 'ISSUE_REPORT';

export type Staff = {
  id: string;
  name: string;
  phone: string;
  locationId: string;
  role: StaffRole;
  permissions: StaffPermission[];
  status: 'ACTIVE' | 'SUSPENDED';
  joinedAt: ISO;
  /** Reachable through the demo staff sign-in (mobile 9876543210 + location PIN code). */
  demoLogin: boolean;
};

/* ───────────── Orders ───────────── */

export type OrderStatus =
  | 'REQUEST_SUBMITTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_COMPLETED'
  | 'AWAITING_STAFF_ACCEPTANCE'
  | 'ACCEPTED'
  | 'PICKUP_CONFIRMED'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'AWAITING_CUSTOMER_VERIFICATION'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/**
 * The wash floor's own steps inside PROCESSING. Customers keep seeing one simple "Processing" status; staff see
 * these. RECEIVED is the order's ACCEPTED/PICKUP_CONFIRMED status, and READY_FOR_DISPATCH is READY_FOR_DELIVERY.
 */
export type ProcessingStage = 'SORTING' | 'WASHING' | 'DRYING' | 'IRONING' | 'QUALITY_CHECK';

export type PaymentStatus = 'REQUIRED' | 'COMPLETED' | 'FAILED' | 'REVERSED';

/** One kind of garment inside an order line, e.g. 3 shirts sent for "Wash & iron · Normal wash". */
export type OrderGarment = {
  garmentId: string;
  name: string;
  icon: GarmentIcon;
  groupId: string;
  qty: number;
};

export type OrderLine = {
  itemId: string;
  name: string;
  icon: GarmentIcon;
  categoryId: string;
  categoryName: string;
  unit: 'piece' | 'pair' | 'kg';
  unitPrice: number;
  qty: number;
  amount: number;
  /** The clothes the customer listed for this service. For a per-kg service `qty` is the estimated weight. */
  garments?: OrderGarment[];
};

export type PickupDetails = {
  address: string;
  landmark?: string;
  contactPhone: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  slotLabel: string;
};

export type Payment = {
  status: PaymentStatus;
  amount: number;
  method: 'WALLET';
  txnId?: string;
  paidAt?: ISO;
  reversalTxnId?: string;
  reversedAt?: ISO;
  lastFailure?: { at: ISO; reason: string; balance: number; shortfall: number };
  failedAttempts: number;
};

export type LaundryOrder = {
  id: string;
  customerId: string;
  locationId: string;
  serviceMode: ServiceMode;
  status: OrderStatus;
  lines: OrderLine[];
  pieces: number;
  subtotal: number;
  serviceCharge: number;
  total: number;
  discount?: number;
  couponCode?: string;
  pickup?: PickupDetails;
  instructions?: string;
  payment: Payment;
  /** ORDER_SUBMISSION (office) or PICKUP_COLLECTION (home pickup) token. */
  intakeQrId: string;
  deliveryQrId?: string;
  acceptedBy?: string;
  acceptedAt?: ISO;
  rejectedBy?: string;
  rejectedAt?: ISO;
  rejectionReason?: string;
  cancelledAt?: ISO;
  cancelReason?: string;
  processingBy?: string;
  readyBy?: string;
  handoverBy?: string;
  verification?: { confirmedAt: ISO; piecesConfirmed: number };
  deliveredBy?: string;
  deliveredAt?: ISO;
  receiptId?: string;
  /** Wash-floor step while the order is PROCESSING. Absent on orders processed before stages existed. */
  processingStage?: ProcessingStage;
  /** The staff member a supervisor gave this order to. Others at the branch can't act on it while it's set. */
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: ISO;
  createdAt: ISO;
  updatedAt: ISO;
};

/* ───────────── QR tokens ───────────── */

export type QrPurpose = 'ORDER_SUBMISSION' | 'PICKUP_COLLECTION' | 'CUSTOMER_DELIVERY_VERIFICATION';
export type QrStatus = 'LOCKED' | 'ACTIVE' | 'CONSUMED' | 'REVOKED';

export type QrScan = { at: ISO; staffId: string; result: 'VALID' | 'REFUSED' | 'CONSUMED'; reason: string };

export type QrToken = {
  id: string;
  /** Random, unguessable reference. The QR holds only this and the purpose — never customer details. */
  token: string;
  orderId: string;
  locationId: string;
  purpose: QrPurpose;
  status: QrStatus;
  createdAt: ISO;
  activatedAt?: ISO;
  /** How long it stays valid once active. */
  ttlMinutes: number;
  expiresAt?: ISO;
  consumedAt?: ISO;
  consumedBy?: string;
  revokedAt?: ISO;
  revokeReason?: string;
  scans: QrScan[];
};

/* ───────────── Money ───────────── */

export type WalletAccount = { id: string; customerId: string; currency: 'INR'; status: 'ACTIVE'; createdAt: ISO };

/** Same shape as the customer app's WalletTxn (types/models.ts), plus the owner and an idempotency key. */
export type WalletTransaction = {
  id: string;
  customerId: string;
  type: 'credit' | 'debit' | 'refund';
  source: 'topup' | 'referral' | 'bonus' | 'order' | 'refund';
  amount: number;
  title: string;
  date: ISO;
  status: 'completed' | 'pending';
  orderId?: string;
  /** One payment per order: "pay:WB-1001"; one reversal per order: "reverse:WB-1001". */
  idempotencyKey?: string;
};

/* ───────────── Receipts, issues, notifications, activity ───────────── */

export type Receipt = {
  id: string;
  number: string;
  orderId: string;
  customerId: string;
  issuedAt: ISO;
  acceptedBy: string;
  /** Set once the customer has watched the printing animation, so it never replays. */
  animationShownAt?: ISO;
};

export type IssueKind = 'MISSING_ITEMS' | 'DAMAGED' | 'WRONG_ITEMS' | 'OTHER';

export type DeliveryIssue = {
  id: string;
  orderId: string;
  customerId: string;
  kind: IssueKind;
  /** Item lines where the count didn't match. */
  mismatches: { itemId: string; name: string; expected: number; received: number }[];
  note: string;
  status: 'OPEN' | 'RESOLVED';
  /** Who raised it: the customer while checking their clothes, or staff during processing. Customer if absent. */
  source?: 'customer' | 'staff';
  /** Staff id, when staff raised it. */
  reportedBy?: string;
  reportedAt: ISO;
  resolvedAt?: ISO;
  resolvedBy?: string;
  resolution?: string;
};

export type NotificationKind =
  | 'ORDER_SUBMITTED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'NEW_REQUEST'
  | 'ORDER_ACCEPTED'
  | 'ORDER_REJECTED'
  | 'REFUND_ISSUED'
  | 'ORDER_CANCELLED'
  | 'PROCESSING'
  | 'READY'
  | 'VERIFY_CLOTHES'
  | 'DELIVERY_QR_READY'
  | 'DELIVERED'
  | 'ISSUE_REPORTED'
  | 'ISSUE_RESOLVED';

export type LaundryNotification = {
  id: string;
  audience: 'customer' | 'staff' | 'admin';
  /** customerId for customers, locationId for staff, 'admin' for the portal. */
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  orderId?: string;
  createdAt: ISO;
  readAt?: ISO;
};

export type ActorKind = 'customer' | 'staff' | 'admin' | 'system';
export type Actor = { kind: ActorKind; id: string; name: string };

export type ActivityType =
  | 'STATUS_CHANGED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_REVERSED'
  | 'QR_ISSUED'
  | 'QR_UNLOCKED'
  | 'QR_SCANNED'
  | 'QR_REFUSED'
  | 'QR_CONSUMED'
  | 'QR_REVOKED'
  | 'RECEIPT_ISSUED'
  | 'VERIFICATION_CONFIRMED'
  | 'ISSUE_REPORTED'
  | 'ISSUE_RESOLVED'
  | 'STAGE_CHANGED'
  | 'ASSIGNED'
  | 'NOTE';

export type OrderActivity = {
  id: string;
  orderId: string;
  at: ISO;
  type: ActivityType;
  actor: Actor;
  message: string;
  from?: OrderStatus;
  to?: OrderStatus;
  locationId: string;
};

/* ───────────── The whole state ───────────── */

export type Counters = { order: number; receipt: number; txn: number; qr: number; notification: number; activity: number; issue: number; customer: number };

export type MockState = {
  schema: number;
  seededAt: ISO;
  counters: Counters;
  locations: Location[];
  catalog: Catalog;
  customers: Customer[];
  staff: Staff[];
  orders: LaundryOrder[];
  walletAccounts: WalletAccount[];
  walletTransactions: WalletTransaction[];
  qrTokens: QrToken[];
  receipts: Receipt[];
  issues: DeliveryIssue[];
  notifications: LaundryNotification[];
  activities: OrderActivity[];
};

/** What a business operation needs besides the state: the time it happens at. */
export type OpContext = { now: ISO };
