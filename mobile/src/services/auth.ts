/**
 * Authentication service boundary for the OTP sign-in flow.
 *
 * DEMO BUILD: `authService` is an in-memory mock with simulated latency — it makes
 * no network requests. To go live, implement `AuthService` against the real API
 * and swap the export at the bottom; screens depend only on this interface.
 */

export type OtpChallenge = {
  requestId: string;
  /** E.164, e.g. +919876543210 */
  phone: string;
  /** Seconds before another code may be requested. */
  resendAfter: number;
};

export type Session = { token: string; phone: string };

export type AuthErrorCode = 'INVALID_OTP' | 'EXPIRED_OTP' | 'SEND_FAILED';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message: string) {
    super(message);
  }
}

export type SocialProvider = 'google' | 'apple';

export interface AuthService {
  requestOtp(phone: string): Promise<OtpChallenge>;
  verifyOtp(requestId: string, code: string): Promise<Session>;
  /** Google / Apple sign-in. The demo mock signs in straight away; a real build runs the provider's flow. */
  signInWithProvider(provider: SocialProvider): Promise<Session>;
}

/** True while `authService` is the in-memory mock; the UI shows the demo code only then. */
export const AUTH_IS_DEMO = true;

/** The only code the demo accepts. Development fixture — never used by a real backend. */
export const DEMO_OTP = '123456';
/** Entering a number ending in this triggers the send-failure state, for demoing errors. */
export const DEMO_FAILING_SUFFIX = '0000';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createMockAuthService(): AuthService {
  const challenges = new Map<string, { phone: string; expiresAt: number }>();
  return {
    async requestOtp(phone) {
      await wait(900);
      if (phone.endsWith(DEMO_FAILING_SUFFIX)) {
        throw new AuthError('SEND_FAILED', "We couldn't send a code right now. Please try again.");
      }
      const requestId = Math.random().toString(36).slice(2);
      challenges.set(requestId, { phone, expiresAt: Date.now() + 5 * 60_000 });
      return { requestId, phone, resendAfter: 30 };
    },
    async verifyOtp(requestId, code) {
      await wait(800);
      const challenge = challenges.get(requestId);
      if (!challenge || challenge.expiresAt < Date.now()) {
        throw new AuthError('EXPIRED_OTP', 'This code has expired. Request a new one.');
      }
      if (code !== DEMO_OTP) {
        throw new AuthError('INVALID_OTP', "That code doesn't match. Check the SMS and try again.");
      }
      challenges.delete(requestId);
      return { token: `demo.${requestId}`, phone: challenge.phone };
    },
    async signInWithProvider(provider) {
      await wait(700);
      return { token: `demo.${provider}.${Math.random().toString(36).slice(2)}`, phone: '' };
    },
  };
}

export const authService: AuthService = createMockAuthService();
