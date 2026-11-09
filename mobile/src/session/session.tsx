import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { STAFF_DEMO_LOGIN } from '../mock/seed';
import type { Session as AuthSession } from '../services/auth';
import type { Profile } from '../services/profile';

/**
 * Onboarding is a small state machine, persisted so a refresh or relaunch resumes where the
 * user left off (and a finished user never sees sign-in again):
 *
 *   (no session) → PHONE_VERIFIED → PROFILE_COMPLETED → ONBOARDING_COMPLETED
 *
 * The navigator renders screens from `stage`, so the UI always reflects the real state.
 */
export type OnboardingStage = 'PHONE_VERIFIED' | 'PROFILE_COMPLETED' | 'ONBOARDING_COMPLETED';

/** 'staff' when signed in with the demo staff number (see src/mock/data/staff.json); everyone else is a customer. */
export type SessionRole = 'customer' | 'staff';

export type UserSession = AuthSession & {
  displayPhone: string;
  stage: OnboardingStage;
  profile?: Profile;
  pincode?: string;
  role?: SessionRole;
  /** Staff only: the mock staff account chosen by the location PIN code. MOCK sign-in, not real security. */
  staffId?: string;
};

type SessionContext = {
  /** False until the stored session has been read. */
  ready: boolean;
  session: UserSession | null;
  /** Skipped sign-in for now: browsing the app without an account (this launch only). */
  guest: boolean;
  continueAsGuest(): void;
  signIn(auth: AuthSession, displayPhone: string): Promise<void>;
  completeProfile(profile: Profile): Promise<void>;
  completePincode(pincode: string): Promise<void>;
  /** Staff: the location PIN code picked their staff account; they skip the customer details step. */
  completeStaffSignIn(staffId: string, pincode: string): Promise<void>;
  /** DEMO ONLY: work as another staff account at the same branch, to try each role. Not real security. */
  switchStaff(staffId: string): Promise<void>;
  signOut(): Promise<void>;
};

const STORAGE_KEY = 'wb.session.v1';

async function saveSecureSession(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        await AsyncStorage.removeItem(key).catch(() => {});
        return;
      }
    } catch {
      // Fallback to AsyncStorage
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function loadSecureSession(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        const val = await SecureStore.getItemAsync(key);
        if (val) return val;
        const legacy = await AsyncStorage.getItem(key);
        if (legacy) {
          await SecureStore.setItemAsync(key, legacy, {
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
          }).catch(() => {});
          await AsyncStorage.removeItem(key).catch(() => {});
          return legacy;
        }
        return null;
      }
    } catch {
      // Fallback to AsyncStorage
    }
  }
  return await AsyncStorage.getItem(key);
}

async function clearSecureSession(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        await SecureStore.deleteItemAsync(key).catch(() => {});
      }
    } catch {
      // ignore
    }
  }
  await AsyncStorage.removeItem(key).catch(() => {});
}

const digits = (p: string) => p.replace(/\D/g, '').slice(-10);
/** Only the demo staff number signs in as staff. */
export const isStaffPhone = (phone: string) => !!phone && digits(phone) === digits(STAFF_DEMO_LOGIN.phone);
const ORDER: OnboardingStage[] = ['PHONE_VERIFIED', 'PROFILE_COMPLETED', 'ONBOARDING_COMPLETED'];
const later = (a: OnboardingStage, b: OnboardingStage) => (ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b);

const Ctx = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [guest, setGuest] = useState(false);
  const current = useRef<UserSession | null>(null);

  const commit = useCallback(async (next: UserSession | null) => {
    current.current = next;
    setSession(next);
    try {
      if (next) await saveSecureSession(STORAGE_KEY, JSON.stringify(next));
      else await clearSecureSession(STORAGE_KEY);
    } catch {
      // Storage unavailable (private browsing): the session still works for this launch.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadSecureSession(STORAGE_KEY)
      .then((raw) => {
        const stored = raw ? (JSON.parse(raw) as UserSession) : null;
        if (alive && stored?.token && ORDER.includes(stored.stage)) {
          current.current = stored;
          setSession(stored);
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<SessionContext>(
    () => ({
      ready,
      session,
      guest,
      continueAsGuest() {
        setGuest(true);
      },
      async signIn(auth, displayPhone) {
        setGuest(false);
        await commit({ ...auth, displayPhone, stage: 'PHONE_VERIFIED', role: isStaffPhone(auth.phone) ? 'staff' : 'customer' });
      },
      async completeProfile(profile) {
        const s = current.current;
        if (!s) throw new Error('Not signed in');
        await commit({ ...s, profile, stage: later(s.stage, 'PROFILE_COMPLETED') });
      },
      async completePincode(pincode) {
        const s = current.current;
        if (!s?.profile) throw new Error('Profile step not completed');
        await commit({ ...s, pincode, stage: 'ONBOARDING_COMPLETED' });
      },
      async completeStaffSignIn(staffId, pincode) {
        const s = current.current;
        if (!s || s.role !== 'staff') throw new Error('Not signed in as staff');
        await commit({ ...s, staffId, pincode, stage: 'ONBOARDING_COMPLETED' });
      },
      async switchStaff(staffId) {
        const s = current.current;
        if (!s || s.role !== 'staff' || s.stage !== 'ONBOARDING_COMPLETED') throw new Error('Not signed in as staff');
        await commit({ ...s, staffId });
      },
      async signOut() {
        setGuest(false);
        await commit(null);
      },
    }),
    [ready, session, guest, commit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
