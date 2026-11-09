import { useSharedValue } from 'react-native-reanimated';

export function useAnimatedKeyboardSafe() {
  const height = useSharedValue(0);
  const state = useSharedValue(0);
  return { height, state };
}
