/**
 * Data models for the customer app. The mock JSON in src/mock-data follows these shapes, and a
 * real API should return the same shapes so the screens never need to change.
 */

export type ISODate = string; // e.g. "2026-11-04" or "2026-11-01T10:20:00+05:30"

export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  memberSince: ISODate;
  referralCode: string;
};

export type AddressLabel = 'Home' | 'Work' | 'Other';

export type Address = {
  id: string;
  label: AddressLabel;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  isDefault: boolean;
};

/** One per section of the printed price list (price-menu.json). */
export type ServiceId = 'only-wash' | 'wash-iron' | 'shoes-bags' | 'stain' | 'dye' | 'dry-clean' | 'blanket';

export type Service = {
  id: ServiceId;
  name: string;
  tagline: string;
  description: string;
  turnaround: string;
  /** Key into the app's illustration registry. */
  art: string;
};

export type PriceUnit = 'kg' | 'piece' | 'pair' | 'panel';

export type PriceItem = { id: string; name: string; price: number; unit: PriceUnit };

export type PriceCategory = { serviceId: ServiceId; note: string; items: PriceItem[] };

/** The printed price list, as written: sections of items priced per kg, pair or piece; blankets have a second
 *  (double) price. Booking's per-item prices are built from this, so there's one list to keep up to date. */
export type MenuItem = { name: string; price: number; price2?: number };
export type MenuSection = { id: ServiceId; title: string; unit: 'kg' | 'pair' | 'pc'; note: string; columns?: string[]; items: MenuItem[] };
export type PriceMenu = { sections: MenuSection[]; note: string; fees: { delivery: number; freeDeliveryAbove: number } };

export type Pricing = {
  currency: 'INR';
  fees: { delivery: number; freeDeliveryAbove: number };
  categories: PriceCategory[];
};

/** The garment journey, in order. `cancelled` sits outside it. */
export const ORDER_STAGES = [
  'collected',
  'washing_drying',
  'ironing_packing',
  'out_for_delivery',
  'delivered',
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];
export type OrderStatus =
  | OrderStage
  | 'pickup_scheduled'
  | 'washing'
  | 'drying'
  | 'ironing'
  | 'packing'
  | 'cancelled';

export type OrderItem = { priceItemId: string; qty: number };

export type PaymentMethod = 'Pay on delivery' | 'Wallet' | 'UPI' | 'Card';
export type PaymentStatus = 'pending' | 'paid' | 'not_charged';

export type Order = {
  id: string;
  serviceId: ServiceId;
  status: OrderStatus;
  placedAt: ISODate;
  pickup: { date: ISODate; slotId: string; addressId: string };
  estimatedDelivery: ISODate;
  deliveredAt?: ISODate;
  items: OrderItem[];
  discount: number;
  payment: { method: PaymentMethod; status: PaymentStatus };
  requestId?: string;
  cancelReason?: string;
};

/** An order with its amounts worked out from the price list. */
export type PricedLine = { item: PriceItem; qty: number; amount: number };
export type OrderTotals = { lines: PricedLine[]; garments: number; subtotal: number; delivery: number; discount: number; total: number };

export type RequestStatus = 'pending' | 'confirmed' | 'picked_up' | 'cancelled';

export type PickupRequest = {
  id: string;
  serviceId: ServiceId;
  createdAt: ISODate;
  pickupDate: ISODate;
  slotId: string;
  addressId: string;
  status: RequestStatus;
  notes?: string;
  orderId?: string;
  cancelReason?: string;
};

export type PickupSlot = { id: string; label: string; period: 'Morning' | 'Afternoon' | 'Evening' };

export type PickupSlots = {
  /** How many days ahead pickups can be booked, starting tomorrow. */
  daysAhead: number;
  slots: PickupSlot[];
  /** Slots already full: day offset from tomorrow (0 = tomorrow) and slot id. */
  fullyBooked: { dayOffset: number; slotId: string }[];
};

export type WalletTxnType = 'credit' | 'debit' | 'refund';
/** Where the money came from or went, so each entry can be told apart at a glance. */
export type WalletTxnSource = 'topup' | 'referral' | 'bonus' | 'order' | 'refund';
export type WalletTxn = {
  id: string;
  type: WalletTxnType;
  source?: WalletTxnSource;
  amount: number;
  title: string;
  /** Full timestamp, so the app can say exactly when it happened. */
  date: ISODate;
  status: 'completed' | 'pending';
  orderId?: string;
};

export type WalletConfig = {
  presets: number[];
  limits: { min: number; max: number };
  /** Extra credit on larger top-ups, e.g. 5% on ₹2,000 or more. */
  topUpBonus: { percent: number; minAmount: number };
};

export type OfferStatus = 'active' | 'upcoming' | 'expired';
export type Offer = {
  id: string;
  title: string;
  description: string;
  validFrom: ISODate;
  validUntil: ISODate;
  eligibility: string;
  serviceIds: ServiceId[] | 'all';
  status: OfferStatus;
  code?: string;
  discountBadge?: string;
  badgeLabel?: string;
  discountValue?: string;
};

export type ReferralStatus = 'invited' | 'joined' | 'rewarded';
export type Referral = { id: string; name: string; date: ISODate; status: ReferralStatus; reward: number };
/** A friend's code this customer signed up with (one per account). */
export type AppliedReferral = { code: string; owner: string; appliedAt: ISODate };
export type ReferralCodeRules = { minLength: number; maxLength: number; welcomeReward: number };

export type ReferralProgram = {
  rewardPerReferral: number;
  applied: AppliedReferral | null;
  steps: string[];
  history: Referral[];
};

export type NotificationType = 'order' | 'pickup' | 'delivery' | 'account';
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  orderId?: string;
  requestId?: string;
  /** A laundry order (WB-1001 style) in the shared laundry mock data. */
  laundryOrderId?: string;
};

export type SupportCategory = { id: string; title: string; icon: string };
export type SupportTicket = {
  id: string;
  subject: string;
  categoryId: string;
  createdAt: ISODate;
  status: 'open' | 'resolved';
  orderId?: string;
  message?: string;
};
export type SupportInfo = {
  contact: { phone: string; email: string; hours: string };
  categories: SupportCategory[];
  tickets: SupportTicket[];
};

export type Faq = { id: string; categoryId: string; question: string; answer: string };

export type Dashboard = {
  tagline: string;
  booking: { title: string; message: string; cta: string };
  promo: { title: string; message: string; cta: string; offerId: string };
  emptyOrder: { title: string; message: string };
  trust: { icon: string; title: string; body: string }[];
};
