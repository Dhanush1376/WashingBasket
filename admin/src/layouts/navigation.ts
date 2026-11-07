import type { IconName } from '@/components/ui/Icon';

export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  /** One line under the label in the mobile menu, so new staff know what each page is for. */
  hint: string;
  badge?: 'pickups' | 'support' | 'orders';
};

export type NavGroup = { title: string; items: NavItem[] };

/**
 * Grouped logically:
 * 1. Daily work: Core operations handled throughout the day (Dashboard, Orders, Pickups, Customers, Support)
 * 2. Laundry operations: Core operational laundry setup (Locations, Staff, Services & prices, Pickup schedules)
 * 3. Growth & Money: Customer engagement, promotions, and financial management (Offers, Wallet, Refer & earn)
 */
export const NAV: NavGroup[] = [
  {
    title: 'Daily work',
    items: [
      { to: '/', label: 'Dashboard', icon: 'grid', hint: 'Today at a glance' },
      { to: '/orders', label: 'Orders', icon: 'bag', hint: 'Move orders along', badge: 'orders' },
      { to: '/pickups', label: 'Pickup requests', icon: 'calendar', hint: 'Confirm and collect', badge: 'pickups' },
      { to: '/customers', label: 'Customers', icon: 'users', hint: 'Profiles and history' },
      { to: '/support', label: 'Help requests', icon: 'headset', hint: 'Reply to customers', badge: 'support' },
    ],
  },
  {
    title: 'Laundry operations',
    items: [
      { to: '/laundry/locations', label: 'Locations', icon: 'mapPin', hint: 'Campus stores & drop-off desks' },
      { to: '/laundry/staff', label: 'Staff', icon: 'shield', hint: 'Counter & delivery team' },
      { to: '/services', label: 'Services & prices', icon: 'list', hint: 'Service catalog & pricing' },
      { to: '/schedule', label: 'Pickup times & areas', icon: 'clock', hint: 'Time slots & service PINs' },
    ],
  },
  {
    title: 'Growth & Money',
    items: [
      { to: '/offers', label: 'Offers', icon: 'tag', hint: 'Coupons and promotional deals' },
      { to: '/wallet', label: 'Wallet', icon: 'wallet', hint: 'Customer balances and history' },
      { to: '/referrals', label: 'Refer & earn', icon: 'gift', hint: 'Referral rewards program' },
    ],
  },
];

/** The four most used pages, in the phone's bottom bar. */
export const MOBILE_TABS: NavItem[] = [NAV[0].items[0], NAV[0].items[1], NAV[0].items[2], NAV[0].items[3]];
