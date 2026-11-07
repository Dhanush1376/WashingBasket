import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type Props = {
  progress: SharedValue<number>;
  /** Position in the stagger; each step starts a little after the previous one. */
  index: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const STEP = 0.09;
const SPAN = 0.5;

/** Staggered fade-and-rise driven by one shared progress value (0 → 1). */
export function Reveal({ progress, index, style, children }: Props) {
  const animated = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - index * STEP) / SPAN));
    const eased = 1 - Math.pow(1 - t, 3);
    return { opacity: eased, transform: [{ translateY: (1 - eased) * 14 }] };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
