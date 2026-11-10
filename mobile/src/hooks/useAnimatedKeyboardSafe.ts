import { useAnimatedKeyboard } from 'react-native-reanimated';

/**
 * The keyboard's height, frame by frame, measured from the bottom of the screen (so it includes the home-indicator
 * / navigation-bar area).
 *
 * The two Android flags matter. The app draws edge to edge, under the status and navigation bars. Without the
 * flags, Reanimated assumes it doesn't and "fixes" the window while any screen uses this hook. It adds margins the
 * height of both bars around the whole app, and when the hook goes away it turns edge-to-edge off. The app then
 * jumped and resized while you typed, and taps landed in the wrong place.
 */
const OPTIONS = { isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true };

export function useAnimatedKeyboardSafe() {
  return useAnimatedKeyboard(OPTIONS);
}
