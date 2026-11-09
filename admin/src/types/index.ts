/**
 * Admin data shapes. Everything the customer app already defines is imported from it, so a field
 * means the same thing on both sides; the admin versions only add who a record belongs to and the
 * few settings the team manages.
 */
import type {
  Address,
  AppNotification,
  ISODate,
  Offer,
  Order,
  PickupRequest,
  PickupSlot,
  PickupSlots,
  ReferralStatus,
  Service,
  SupportCategory,
  SupportTicket,
  WalletTxn,
} from '@customer/types/models';

export type {
  ReferralStatus,
  ISODate,
  OrderStatus,
  OrderTotals,
  PaymentMethod,
  PaymentStatus,
  PriceItem,
  PriceUnit,
  PriceCategory,
  RequestStatus,
  ServiceId,
  OfferStatus,
  NotificationType,
  WalletTxnType,
  WalletTxnSource,
  PickupSlot,
  SupportCategory,
  Faq,
  Pricing,
  WalletConfig,
} from '@customer/types/models';

export const ORDER_STAGES = [
  'pickup_scheduled',
  'collected',
  'washing',
  'drying',
  'ironing',
  'packing',
  'out_for_delivery',
  'delivered',
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export type CustomerStatus = 'active' | 'paused';

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  customerSince: ISODate;
  verification: { phone: boolean; email: boolean };
  avatarUrl?: string;
  status: CustomerStatus;
  referralCode: string;
  referredBy: string | null;
  lastActiveAt: ISODate | null;
  /** Private note for the team; customers never see it. */
  note: string;
};

export type CustomerAddress = Address & { customerId: string; pickupInstructions: string | null };
export type AdminOrder = Order & { customerId: string };
export type AdminRequest = PickupRequest & { customerId: string };
export type AdminWalletTxn = WalletTxn & { customerId: string };

export type AdminOffer = Offer & {
  /** Hidden offers stay saved but customers don't see them. */
  visible: boolean;
  /** 1 = shown first on the Offers page and Home. */
  position: number;
};

export type AdminService = Service & { available: boolean; position: number };

export type AdminPickupSlot = PickupSlot & { enabled: boolean };
export type AdminPickupSlots = Omit<PickupSlots, 'slots'> & { slots: AdminPickupSlot[] };

export type ServiceArea = { pincode: string; area: string; city: string; active: boolean; note: string; hubId?: string };

export type AdminReferral = {
  id: string;
  referrerId: string;
  friendName: string;
  friendCustomerId: string | null;
  date: ISODate;
  status: ReferralStatus;
  reward: number;
};

export type ReferralProgramSettings = {
  rewardPerReferral: number;
  welcomeReward: number;
  codeLength: { min: number; max: number };
  steps: string[];
};

export type AdminNotification = AppNotification & {
  /** null = sent to every customer. */
  customerId: string | null;
  /** Automatic messages come from order updates; team messages were written here. */
  sentBy: 'automatic' | 'team';
};

export type TicketReply = { id: string; from: 'team' | 'customer'; body: string; at: ISODate };
export type AdminTicket = SupportTicket & { customerId: string; replies: TicketReply[] };
export type SupportData = {
  contact: { phone: string; email: string; hours: string };
  categories: SupportCategory[];
  tickets: AdminTicket[];
};

export type HomeSectionId = 'greeting' | 'overview' | 'perks' | 'booking' | 'recentOrders' | 'services' | 'offers';
export type HomeSection = { id: HomeSectionId; name: string; description: string; visible: boolean; fixed: boolean };
export type PerkTint = 'orange' | 'navy' | 'green';
export type HomePerk = { id: string; icon: string; label: string; tint: PerkTint };
export type HomepageContent = {
  tagline: string;
  sections: HomeSection[];
  booking: { kicker: string; title: string; cta: string; art: string; message: string };
  perks: HomePerk[];
  promo: { title: string; message: string; cta: string; offerId: string };
  emptyOrder: { title: string; message: string };
  trust: { icon: string; title: string; body: string }[];
};

export type AdminProfile = {
  user: { id: string; name: string; role: string; email: string };
  business: { name: string; city: string };
};

export type { Address, Offer, Order, PickupRequest, Service, WalletTxn };
