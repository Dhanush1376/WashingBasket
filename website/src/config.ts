/**
 * Links the site hands visitors on to, all from the environment (see .env.example), so going live on a
 * store is a config change, not a code change. A store link is only used if it is https and on that
 * store's own domain. Washing Basket is not on either store yet, so until a listing URL is configured
 * the badge shows a "Coming soon" state instead of linking anywhere.
 */
export type StoreId = 'googlePlay' | 'appStore';

const FROM_ENV: Record<StoreId, string | undefined> = {
  googlePlay: import.meta.env.VITE_PLAY_STORE_URL,
  appStore: import.meta.env.VITE_APP_STORE_URL,
};
const HOST: Record<StoreId, string> = { googlePlay: 'play.google.com', appStore: 'apps.apple.com' };

export const STORE_LABEL: Record<StoreId, { kicker: string; name: string }> = {
  googlePlay: { kicker: 'Get it on', name: 'Google Play' },
  appStore: { kicker: 'Download on the', name: 'App Store' },
};

function valid(id: StoreId, raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === HOST[id] ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The live listing for a store, or null while the app is not published there. */
export const storeHref = (id: StoreId): string | null => valid(id, FROM_ENV[id]);

/** The web build of the app, if configured (in development, the local Expo server). */
export const WEB_APP_URL: string | null =
  import.meta.env.VITE_WEB_APP_URL?.trim() || (import.meta.env.DEV ? 'http://localhost:8083' : null);
