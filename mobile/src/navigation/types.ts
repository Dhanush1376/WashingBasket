import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { OrderFilter } from '../services/mock/orders.service';
import type { ServiceId } from '../types/models';

/** Bottom tabs inside the signed-in app. */
export type MainTabParamList = {
  Home: undefined;
  Wallet: undefined;
  Book: { serviceId?: ServiceId } | undefined;
  Orders: { filter?: OrderFilter } | undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  // sign-in and onboarding
  Login: undefined;
  Otp: { requestId: string; phone: string; displayPhone: string; resendAfter: number };
  Details: undefined;
  Pincode: undefined;
  // the app
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  OrderDetail: { orderId: string };
  BookingSuccess: { requestId: string };
  /** `offerId` opens the page on that coupon (from Home's offer deck). */
  Offers: { offerId?: string } | undefined;
  Refer: undefined;
  PriceList: undefined;
  Support: undefined;
  Notifications: undefined;
  EditProfile: undefined;
  AddAddress: undefined;
  Intro: undefined;
  // laundry orders (customer)
  /** `pay` opens the pay & unlock QR drawer straight away (right after confirming the laundry slip). */
  LaundryOrder: { orderId: string; pay?: boolean };
  Receipt: { orderId: string };
  VerifyClothes: { orderId: string };
  // staff (signed in with the demo staff number)
  StaffTabs: NavigatorScreenParams<StaffTabParamList> | undefined;
  StaffReview: { orderId: string; qrId: string };
  StaffOrder: { orderId: string };
  StaffDelivery: { orderId: string; qrId: string };
  StaffNotifications: undefined;
};

/** The staff app's five tabs: Home, Wallet (Salary), Scan, Support and Profile. */
export type StaffTabParamList = {
  StaffHome: undefined;
  StaffSalary: undefined;
  /** `orderId` + `intent` when started from an order: a code for another order or purpose is refused. */
  StaffScan: { intent?: 'ANY' | 'INTAKE' | 'DELIVERY'; orderId?: string; nonce?: number } | undefined;
  StaffSupport: undefined;
  StaffProfile: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type StaffTabProps<T extends keyof StaffTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<StaffTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
