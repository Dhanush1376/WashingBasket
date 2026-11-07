import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, fonts } from '../../theme';

type Props = { step: number; total?: number };

function ProgressBarSegment({ active }: { active: boolean }) {
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
  }, [active, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fillStyle]} />
    </View>
  );
}

/** Three quiet segments and a step count with smooth animated fill transitions. */
export function OnboardingProgress({ step, total = 3 }: Props) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
    >
      <View style={styles.track}>
        {Array.from({ length: total }, (_, i) => (
          <ProgressBarSegment key={i} active={i < step} />
        ))}
      </View>
      <Text style={styles.count}>
        {step}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flexDirection: 'row', gap: 4 },
  segment: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    backgroundColor: colors.cta,
    borderRadius: 2,
  },
  count: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
});
