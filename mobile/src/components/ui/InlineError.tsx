import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fonts } from '../../theme';
import { AlertCircle } from './icons';

export function InlineError({ message }: { message: string }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={styles.row}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <AlertCircle color={colors.danger} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  text: { flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
});
