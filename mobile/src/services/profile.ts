/**
 * Profile service boundary: saves the details collected during onboarding.
 *
 * DEMO BUILD: like `authService`, this is an in-memory mock with simulated latency and no
 * network requests. Implement `ProfileService` against the real API and swap the export.
 */

export type Profile = {
  fullName: string;
  /** Optional: receipts and order updates by email. */
  email?: string;
};

export class ProfileError extends Error {}

export interface ProfileService {
  saveProfile(token: string, profile: Profile): Promise<Profile>;
  savePincode(token: string, pincode: string): Promise<void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createMockProfileService(): ProfileService {
  const store = new Map<string, { profile?: Profile; pincode?: string }>();
  return {
    async saveProfile(token, profile) {
      await wait(700);
      const clean = { fullName: profile.fullName.trim(), email: profile.email?.trim() || undefined };
      store.set(token, { ...store.get(token), profile: clean });
      return clean;
    },
    async savePincode(token, pincode) {
      await wait(400);
      store.set(token, { ...store.get(token), pincode });
    },
  };
}

export const profileService: ProfileService = createMockProfileService();
