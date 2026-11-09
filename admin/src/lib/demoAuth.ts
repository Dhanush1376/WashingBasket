/*
 * Demo sign-in for the admin portal. There is no account system behind it: any email and password
 * open the portal, which runs on sample data only. It just remembers, in this browser, that someone
 * has been through the sign-in page — for this tab, or until they sign out when "Keep me signed in"
 * is ticked. Nothing is sent anywhere and no password is stored.
 */

const KEY = 'wb_admin_demo_signed_in';

function read(store: () => Storage): string | null {
  try {
    return store().getItem(KEY);
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return read(() => window.sessionStorage) === '1' || read(() => window.localStorage) === '1';
}

export function signIn(remember: boolean): void {
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(KEY, '1');
  } catch {
    // storage blocked (private mode): the portal still opens for this page view
  }
}

export function signOut(): void {
  for (const store of [() => window.sessionStorage, () => window.localStorage]) {
    try {
      store().removeItem(KEY);
    } catch {
      // ignore
    }
  }
}

/* The brand intro plays once per browser session, like the customer app; ?intro forces it, ?skip skips it. */
const INTRO_KEY = 'wb_admin_intro_played';

export function shouldPlayIntro(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('intro')) return true;
    if (params.has('skip')) return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return window.sessionStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markIntroPlayed(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    // ignore
  }
}
