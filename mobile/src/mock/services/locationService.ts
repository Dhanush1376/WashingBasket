/** Locations and PIN-code serviceability, read from the shared mock store. SIMULATED. */
import * as ops from '../engine/ops.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';
import type { Location } from '../types.ts';

export async function checkPincode(pincode: string): Promise<{ location: Location | null; active: Location[] }> {
  await simulateLatency(650);
  await mockStore.ready();
  const s = mockStore.get();
  const active = s.locations.filter((l) => l.status === 'ACTIVE');
  return { location: active.find((l) => l.pincode === pincode) ?? null, active };
}

export async function setLocationStatus(locationId: string, status: 'ACTIVE' | 'PAUSED') {
  await simulateLatency(400);
  return mockStore.transact((s) => ops.setLocationStatus(s, { locationId, status }).id);
}
