import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** A short, damped horizontal shake for rejected input. */
export function useShake() {
  const x = useSharedValue(0);
  const shake = useCallback(() => {
    const t = { duration: 55 };
    x.value = withSequence(
      withTiming(-7, t),
      withTiming(6, t),
      withTiming(-4, t),
      withTiming(3, t),
      withTiming(0, t),
    );
  }, [x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return { shake, style };
}
