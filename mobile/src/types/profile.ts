/**
 * Shapes for the customer profile. The JSON in src/mock-data/profile follows these, and a real
 * profile API should return the same shapes so the Profile screen never needs to change.
 */
import type { ISODate, OrderStatus, PaymentStatus, WalletTxn } from './models';

export type CustomerProfile = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  customerSince: ISODate;
  verification: { phone: boolean; email: boolean };
  avatarUrl?: string;
};

export type ProfileWallet = {
  currency: 'INR';
  transactions: WalletTxn[];
};

/** Worked out from the wallet's transactions, so the balance always reconciles. */
export type WalletDetails = {
  balance: number;
  pending: number;
  transactions: WalletTxn[];
};

export type ProfileStatistics = {
  totalOrders: number;
  completedOrders: number;
  activeOrders: number;
  cancelledOrders: number;
};

export type ProfileAddress = {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  pickupInstructions: string | null;
};

export type RecentOrder = {
  id: string;
  service: string;
  status: OrderStatus;
  placedAt: ISODate;
  /** The booked pickup day; not the same as the actual handover. */
  scheduledPickup: ISODate;
  /** When the clothes were actually handed over, or null if that hasn't happened. */
  pickedUpAt: ISODate | null;
  /** When the cleaned clothes were actually returned, or null. */
  deliveredAt: ISODate | null;
  estimatedDelivery: ISODate;
  itemsLabel: string;
  amount: number;
  paymentStatus: PaymentStatus;
};

/** One thing that happened to an order on a given day. */
export type LaundryEventType = 'scheduled_pickup' | 'handover' | 'washing' | 'drying_ironing' | 'delivered' | 'cancelled';

export type LaundryEvent = {
  id: string;
  orderId: string;
  type: LaundryEventType;
  at: ISODate;
  /** End of the booked window, for scheduled pickups. */
  until?: ISODate;
};

/** A calendar event with its order's summary attached, for the day sheet. */
export type LaundryEventDetail = LaundryEvent & { order: RecentOrder | null };

export type Membership = {
  customerSince: ISODate;
  referralCode: string;
  friendsJoined: number;
  rewardsEarned: number;
  rewardsPending: number;
};
