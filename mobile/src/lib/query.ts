import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A deliberately small data-fetching hook (no extra dependency):
 * - results are cached per key, so revisiting a screen shows data instantly and refreshes quietly;
 * - `invalidate(key)` after a change refetches every mounted screen using that key.
 */
const cache = new Map<string, unknown>();
const subscribers = new Map<string, Set<() => void>>();

/*
 * How many first loads (a screen with nothing to show yet) are under way, so the app can put up its full-screen loader
 * when one is slow. Quiet refreshes of data already on screen don't count.
 */
let firstLoads = 0;
const loadWatchers = new Set<(count: number) => void>();
function countFirstLoad(delta: number) {
  firstLoads = Math.max(0, firstLoads + delta);
  loadWatchers.forEach((fn) => fn(firstLoads));
}

/** Calls `fn` with the number of first loads under way, now and whenever it changes. Returns an unsubscribe. */
export function watchFirstLoads(fn: (count: number) => void) {
  loadWatchers.add(fn);
  fn(firstLoads);
  return () => {
    loadWatchers.delete(fn);
  };
}

let appRefreshing = false;
const refreshListeners = new Set<(isRef: boolean) => void>();

export function isAppRefreshing(): boolean {
  return appRefreshing;
}

export function setAppRefreshing(val: boolean) {
  appRefreshing = val;
  refreshListeners.forEach((fn) => fn(val));
}

export function watchRefreshing(fn: (isRef: boolean) => void) {
  refreshListeners.add(fn);
  fn(appRefreshing);
  return () => {
    refreshListeners.delete(fn);
  };
}

/**
 * Triggers an app-wide refresh across all active queries,
 * activating the brand LogoLoader overlay during the refresh sequence.
 */
export async function triggerAppRefresh(): Promise<void> {
  setAppRefreshing(true);
  refetchAll();
  await new Promise((resolve) => setTimeout(resolve, 850));
  setAppRefreshing(false);
}

/** Refetches every query on screen, e.g. after the connection comes back. */
export function refetchAll() {
  subscribers.forEach((set) => set.forEach((fn) => fn()));
}

export function invalidate(...keys: string[]) {
  keys.forEach((k) => subscribers.get(k)?.forEach((fn) => fn()));
}

export function setQueryData<T>(key: string, value: T) {
  cache.set(key, value);
}

export type Query<T> = {
  data: T | undefined;
  error: Error | null;
  /** True only when there is nothing to show yet (first load, or retry after an error). */
  loading: boolean;
  refetch: () => void;
};

export function useQuery<T>(key: string, fetcher: () => Promise<T>): Query<T> {
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!cache.has(key));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    let alive = true;
    const first = !cache.has(key);
    if (first) {
      setLoading(true);
      countFirstLoad(1);
    }
    setError(null);
    fetcherRef
      .current()
      .then((value) => {
        cache.set(key, value);
        if (alive) setData(value);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        if (first) countFirstLoad(-1);
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    let cancel = run();
    const refresh = () => {
      cancel();
      cancel = run();
    };
    const set = subscribers.get(key) ?? new Set();
    set.add(refresh);
    subscribers.set(key, set);
    return () => {
      cancel();
      set.delete(refresh);
    };
  }, [key, run]);

  return { data, error, loading: loading && data === undefined, refetch: run };
}

/** Query keys shared by screens and the actions that change them. */
export const keys = {
  dashboard: 'dashboard',
  orders: 'orders',
  order: (id: string) => `order:${id}`,
  requests: 'requests',
  services: 'services',
  pricing: 'pricing',
  priceMenu: 'price-menu',
  pickupDays: 'pickup-days',
  user: 'user',
  addresses: 'addresses',
  wallet: 'wallet',
  offers: 'offers',
  referrals: 'referrals',
  notifications: 'notifications',
  support: 'support',
  faqs: 'faqs',
  profile: 'profile',
  profileWallet: 'profile-wallet',
  profileStats: 'profile-stats',
  profileAddresses: 'profile-addresses',
  profileOrders: 'profile-orders',
  profileMembership: 'profile-membership',
  profileCalendar: (year: number, month: number) => `profile-calendar:${year}-${month}`,
} as const;
