import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { fonts } from '../../theme';
import { Icon } from './Icon';

const NAVY = '#0A1C3E';
const RED = '#D6453D';
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/**
 * The "log out?" sheet's content: a soft red door icon, one short line, a full-width red Log out and a quiet
 * "Stay signed in" under it. Goes inside a BottomSheet.
 */
export function LogoutConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <View style={styles.root}>
      <Animated.View entering={ZoomIn.duration(260).easing(Easing.out(Easing.cubic))} style={styles.ring}>
        <View style={styles.icon}>
          <Icon name="logout" size={22} color={RED} strokeWidth={2.2} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(260)} style={styles.copy}>
        <Text style={styles.title}>Log out?</Text>
        <Text style={styles.sub}>Sign back in anytime with your phone number.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(260)} style={styles.actions}>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [styles.primary, webCursor, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}
        >
          <Text style={styles.primaryText}>Log out</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Stay signed in"
          style={({ pressed }) => [styles.secondary, webCursor, pressed && { backgroundColor: '#EEEAE2' }]}
        >
          <Text style={styles.secondaryText}>Stay signed in</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingTop: 6 },
  ring: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FDF1F0', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FBE1DF', alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', marginTop: 16 },
  title: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: NAVY },
  sub: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: '#5B6475', marginTop: 4, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 22 },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 18px -8px rgba(214, 69, 61, 0.55)' } as object)
      : { shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3 }),
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  secondary: { height: 48, borderRadius: 24, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 14.5, color: NAVY },
});
