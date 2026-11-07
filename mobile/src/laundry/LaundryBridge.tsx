/**
 * Connects the signed-in person to the shared laundry mock store:
 * - a customer gets (or keeps) their customer record, found by phone, so their wallet and orders follow them;
 * - the older screens that read wallet and notifications through useQuery refresh whenever the store changes.
 */
import { useEffect, useRef } from 'react';

import { invalidate, keys } from '../lib/query';
import { ensureCustomer } from '../mock/services/orderService';
import { mockStore } from '../mock/store/mockStore';
import { useSession } from '../session/session';
import { setActiveCustomer } from './activeCustomer';
import { customerAuthKey, useCurrentCustomer, useMockView } from './hooks';

export function LaundryBridge() {
  const { session } = useSession();
  const view = useMockView();
  const customer = useCurrentCustomer();
  const isCustomer = !!session && session.role !== 'staff' && session.stage === 'ONBOARDING_COMPLETED';

  // make sure the customer has a record (with demo welcome credit the first time)
  const ensured = useRef<string | null>(null);
  useEffect(() => {
    if (!isCustomer || !view.ready || !session) return;
    const key = customerAuthKey(session);
    const sig = `${key}|${session.profile?.fullName ?? ''}|${session.pincode ?? ''}`;
    if (ensured.current === sig) return;
    ensured.current = sig;
    const home = view.state?.locations.find((l) => l.pincode === session.pincode)?.id;
    ensureCustomer({ authKey: key, name: session.profile?.fullName ?? '', phone: session.phone, email: session.profile?.email, homeLocationId: home }).catch(() => {
      ensured.current = null;
    });
  }, [isCustomer, view.ready, view.state, session]);

  useEffect(() => {
    setActiveCustomer(isCustomer && customer ? customer.id : null);
    invalidate(keys.wallet, keys.notifications, keys.profileWallet, keys.dashboard);
  }, [isCustomer, customer]);

  // older screens read the wallet and notifications through useQuery: refresh them when the store changes
  useEffect(() => {
    let last = mockStore.getView().rev;
    return mockStore.subscribe(() => {
      const rev = mockStore.getView().rev;
      if (rev === last) return;
      last = rev;
      invalidate(keys.wallet, keys.notifications, keys.profileWallet, keys.dashboard);
    });
  }, []);

  return null;
}
