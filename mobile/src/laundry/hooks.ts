/** React hooks over the shared laundry mock store. Every screen reads the same live state through these. */
import { useMemo, useSyncExternalStore } from 'react';

import { findLocation, findStaff } from '../mock/engine/selectors';
import { phoneDigits } from '../mock/engine/util';
import { mockStore, type StoreView } from '../mock/store/mockStore';
import type { Customer, Location, MockState, Staff } from '../mock/types';
import { useSession, type UserSession } from '../session/session';

export function useMockView(): StoreView {
  return useSyncExternalStore(mockStore.subscribe, mockStore.getView, mockStore.getView);
}

/** The live state, or null while it loads. */
export function useLaundryState(): MockState | null {
  return useMockView().state;
}

/** How a signed-in customer is found in the mock data: their phone's digits, or the social sign-in token. */
export function customerAuthKey(session: UserSession): string {
  const digits = phoneDigits(session.phone ?? '');
  return digits.length === 10 ? digits : `social:${session.token.split('.').slice(1).join('.') || session.token}`;
}

/** The signed-in customer's record in the mock data (created on first use by LaundryBridge). */
export function useCurrentCustomer(): Customer | null {
  const { session } = useSession();
  const state = useLaundryState();
  return useMemo(() => {
    if (!session || session.role === 'staff' || !state) return null;
    const key = customerAuthKey(session);
    return state.customers.find((c) => c.authKey === key) ?? null;
  }, [session, state]);
}

/** The signed-in staff member and their location. */
export function useCurrentStaff(): { staff: Staff; location: Location } | null {
  const { session } = useSession();
  const state = useLaundryState();
  return useMemo(() => {
    if (!session?.staffId || !state) return null;
    const staff = findStaff(state, session.staffId);
    const location = staff ? findLocation(state, staff.locationId) : undefined;
    return staff && location ? { staff, location } : null;
  }, [session, state]);
}

/** The location a customer's PIN code points at, to preselect when ordering. */
export function usePincodeLocation(): Location | null {
  const { session } = useSession();
  const state = useLaundryState();
  return useMemo(() => state?.locations.find((l) => l.pincode === session?.pincode) ?? null, [state, session?.pincode]);
}
