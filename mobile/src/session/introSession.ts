import { Platform } from 'react-native';

const STORAGE_KEY = 'wb_intro_played_session';
let introPlayedMemory = false;

/**
 * The cinematic intro animation must only play once when the user opens the app
 * (fresh session/launch). Subsequent page reloads or refreshes in the same session
 * will NOT replay the intro animation.
 */
export function shouldPlayIntro(): boolean {
  // Allow explicit override via URL parameter (?intro forces it, ?skip skips it)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('intro')) return true;
      if (params.has('skip')) return false;

      if (window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY) === '1') {
        introPlayedMemory = true;
        return false;
      }
    } catch {
      // In private mode or restricted iframe sessionStorage may throw
    }
  }

  return !introPlayedMemory;
}

/**
 * Record that the intro animation has finished playing for this session.
 */
export function markIntroPlayed(): void {
  introPlayedMemory = true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }
}

/**
 * Resets the session flag (for testing or logout).
 */
export function resetIntroSession(): void {
  introPlayedMemory = false;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
