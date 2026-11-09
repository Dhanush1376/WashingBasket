/**
 * Serviceability boundary: does a PIN code belong to one of our locations?
 *
 * DEMO BUILD: the answer comes from the laundry mock data (src/mock/data/locations.json), where each location has
 * one demo PIN code — LPU 144411, NIT Jalandhar 144011, Model Town 144003. These are development fixtures, not
 * real postal areas. Replace the export with the real serviceability API when it exists.
 */
import { checkPincode } from '../mock/services/locationService';
import type { Location } from '../mock/types';

export type Serviceability = { serviceable: boolean; location: Location | null; activeLocations: Location[] };

export interface ServiceabilityService {
  check(pincode: string): Promise<Serviceability>;
}

/** Six digits. (The demo's Outside Campus code is 000000, so a leading zero is allowed.) */
export function isValidPincode(pin: string) {
  return /^\d{6}$/.test(pin);
}

function createMockServiceability(): ServiceabilityService {
  return {
    async check(pincode) {
      const { location, active } = await checkPincode(pincode);
      return { serviceable: !!location, location, activeLocations: active };
    },
  };
}

export const serviceabilityService: ServiceabilityService = createMockServiceability();
