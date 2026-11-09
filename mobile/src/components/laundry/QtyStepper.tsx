import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { haptic } from '../../lib/haptics';
import { app, colors, fonts, space } from '../../theme';
import { Icon } from '../app/Icon';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/** − count + with the count announced. The minus disappears at zero so an empty row reads as "Add". */
export function QtyStepper({
  value,
  onChange,
  max = 50,
  label,
  compact,
  large,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label: string;
  compact?: boolean;
  /** Big thumb-sized buttons, for lists where people tap a lot (the garment picker). */
  large?: boolean;
}) {
  const size = large ? 34 : compact ? 28 : 32;
  const width = large ? 94 : compact ? 74 : 84;
  const btn = large ? { width: 26, height: 26, borderRadius: 13 } : null;
  const glyph = large ? 13 : 11;
  const set = (n: number) => {
    const next = Math.max(0, Math.min(max, n));
    if (next !== value) {
      haptic.tap();
      onChange(next);
    }
  };
  if (value === 0) {
    return (
      <Animated.View entering={FadeIn.duration(180)}>
        <Pressable
          onPress={() => set(1)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          hitSlop={6}
          style={({ pressed }) => [styles.add, { height: size, width }, webCursor, pressed && { opacity: 0.85 }]}
        >
          <Icon name="plus" size={large ? 15 : 13} color={colors.ink} strokeWidth={2.4} />
          <Text style={[styles.addText, large && styles.addTextLarge]}>Add</Text>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      entering={ZoomIn.duration(180)}
      style={[styles.stepper, { height: size, width }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value, text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <Pressable
        onPress={() => set(value - 1)}
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${label}`}
        hitSlop={6}
        style={({ pressed }) => [styles.btn, btn, styles.btnMinus, webCursor, pressed && { opacity: 0.7 }]}
      >
        <Icon name="minus" size={glyph} color={colors.ink} strokeWidth={2.4} />
      </Pressable>
      {/* the number slides in fresh each time it changes */}
      <Animated.Text key={value} entering={FadeInDown.duration(140)} style={[styles.value, large && styles.valueLarge]}>
        {value}
      </Animated.Text>
      <Pressable
        onPress={() => set(value + 1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`Add one ${label}`}
        hitSlop={6}
        style={({ pressed }) => [
          styles.btn,
          btn,
          styles.btnPlus,
          value >= max && { opacity: 0.35 },
          webCursor,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Icon name="plus" size={glyph} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  addText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },
  addTextLarge: { fontSize: 13 },
  valueLarge: { fontSize: 14.5 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 3,
  },
  btn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMinus: {
    backgroundColor: '#F0F2F5',
  },
  btnPlus: {
    backgroundColor: colors.ink,
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
});
