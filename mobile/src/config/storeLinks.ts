/**
 * App store listings for the "Get the app" buttons (the About page's app showcase).
 *
 * Washing Basket is not published on either store yet, so both start empty and the buttons show
 * "Coming soon" instead of linking anywhere. When a listing goes live, set its URL in one of two ways:
 *
 *   1. Environment (preferred, no code change): in mobile/.env
 *        EXPO_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.washingbasket.app
 *        EXPO_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/id<your-app-id>
 *   2. Or paste it into CONFIGURED below.
 *
 * A URL is only used if it is https and on that store's own domain, so a typo can never send
 * visitors to some other website.
 */
export type StoreId = 'googlePlay' | 'appStore';

const CONFIGURED: Record<StoreId, string> = {
  googlePlay: 'https://play.google.com/store/apps',
  appStore: 'https://apps.apple.com',
};

// Expo inlines EXPO_PUBLIC_* variables at build time; they must be read with these exact names.
const FROM_ENV: Record<StoreId, string | undefined> = {
  googlePlay: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
  appStore: process.env.EXPO_PUBLIC_APP_STORE_URL,
};

const STORE_HOSTS: Record<StoreId, string[]> = {
  googlePlay: ['play.google.com'],
  appStore: ['apps.apple.com'],
};

export const STORE_LABEL: Record<StoreId, { kicker: string; name: string }> = {
  googlePlay: { kicker: 'Download from', name: 'Play Store' },
  appStore: { kicker: 'Download from', name: 'App Store' },
};

function valid(id: StoreId, raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && STORE_HOSTS[id].includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The store listing's URL, or null while the app is not on that store. */
export function storeUrl(id: StoreId): string | null {
  return valid(id, FROM_ENV[id]) ?? valid(id, CONFIGURED[id]);
}
