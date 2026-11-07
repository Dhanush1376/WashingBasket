/**
 * Starts the shared laundry mock store for the app: device storage plus, in development, the admin dev server's
 * mock relay so the admin portal sees the same orders live (see src/mock/store/mockStore.ts).
 *
 * Relay address: EXPO_PUBLIC_MOCK_RELAY_URL if set; on the web, port 5180 of the same host; on a phone, port 5180
 * of the computer serving the bundle (start the portal with `npm run dev -- --host` so the phone can reach it).
 * Without a reachable relay the app keeps working on its own device copy.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import { seedState } from '../mock/seed';
import { mockStore } from '../mock/store/mockStore';

function relayUrl(): string | null {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_MOCK_RELAY_URL;
  if (fromEnv === 'off') return null;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (!__DEV__) return null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Vite may listen on ::1 only, so any loopback address goes through "localhost", which resolves to whichever it uses.
    const host = /^(127\.\d+\.\d+\.\d+|\[::1\])$/.test(window.location.hostname) ? 'localhost' : window.location.hostname;
    return `${window.location.protocol}//${host}:5180`;
  }
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const host = scriptURL ? /^https?:\/\/([^:/]+)/.exec(scriptURL)?.[1] : undefined;
  return host ? `http://${host}:5180` : null;
}

mockStore.configure({
  storage: AsyncStorage,
  relayUrl: relayUrl(),
  seed: seedState,
  clientName: `app-${Platform.OS}`,
});
