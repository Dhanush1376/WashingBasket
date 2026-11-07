/**
 * The laundry order system in the portal: the SAME mock store and engine the customer and staff app use
 * (mobile/src/mock), with the browser's localStorage for persistence and this dev server's mock relay
 * (same origin, see ../../mock-relay.ts) for live sync with the app. Mock data only: no backend, no database.
 */
import { useSyncExternalStore } from 'react';

import { STATUS_COPY, type StatusTone } from '@customer/mock/engine/lifecycle';
import { seedState } from '@customer/mock/seed';
import { mockStore, type StorageAdapter, type StoreView } from '@customer/mock/store/mockStore';
import type { MockState, OrderStatus } from '@customer/mock/types';
import { TONES, type Tone } from '@/lib/status';

const storage: StorageAdapter = {
  async getItem(k) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  async setItem(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked: this visit only */
    }
  },
  async removeItem(k) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

mockStore.configure({ storage, relayUrl: '', seed: seedState, clientName: 'admin-portal' });

export { mockStore };

export function useLaundryView(): StoreView {
  return useSyncExternalStore(mockStore.subscribe, mockStore.getView, mockStore.getView);
}

export function useLaundryState(): MockState | null {
  return useLaundryView().state;
}

export const LAUNDRY_TONE: Record<StatusTone, Tone> = TONES;

export const statusBadge = (s: OrderStatus) => ({ label: STATUS_COPY[s].label, tone: LAUNDRY_TONE[STATUS_COPY[s].tone] });

/** Admin actions are taken by this name in the order history. */
export const ADMIN_NAME = 'Admin (portal)';
