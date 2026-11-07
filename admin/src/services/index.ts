/**
 * The one door every page uses to reach data.
 *
 * Today each module below is a MOCK that reads and writes the in-memory sample data loaded from
 * src/mock/data. To connect a real backend, write API-backed modules with the same function names
 * and return shapes, and point these exports at them. No page or component needs to change.
 */
export const DATA_MODE: 'mock' | 'live' = 'mock';

export * as customersApi from './mock/customers.service';
export * as ordersApi from './mock/orders.service';
export * as requestsApi from './mock/requests.service';
export * as walletApi from './mock/wallet.service';
export * as offersApi from './mock/offers.service';
export * as homepageApi from './mock/homepage.service';
export * as catalogApi from './mock/catalog.service';
export * as schedulingApi from './mock/scheduling.service';
export * as engagementApi from './mock/engagement.service';
export * as dashboardApi from './mock/dashboard.service';

export type { CustomerRow, CustomerDetail, CustomerPatch } from './mock/customers.service';
export type { OrderRow, OrderDetail } from './mock/orders.service';
export type { RequestRow } from './mock/requests.service';
export type { TxnRow, WalletOverview, WalletBalanceRow } from './mock/wallet.service';
export type { OfferInput } from './mock/offers.service';
export type { ServiceRow, ServiceInput, PriceItemInput } from './mock/catalog.service';
export type { AreaRow, SlotInput } from './mock/scheduling.service';
export type { ReferralRow, ReferralOverview, NotificationRow, NotificationInput, TicketRow, FaqInput } from './mock/engagement.service';
export type { Dashboard, Activity, Attention, ActivityKind } from './mock/dashboard.service';
