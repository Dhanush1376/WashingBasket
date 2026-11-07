import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '../../lib/haptics';
import { colors, fonts } from '../../theme';
import { LogoLoader } from '../logo/LogoLoader';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

type Action = { label: string; onPress: () => void };

/**
 * The app's one full-screen loader: the animated logo over the page, which melts into a calm, light blur behind it.
 * Used when the app opens, when a page is slow to load, and when the connection drops. It fades in and out on its own
 * as `visible` changes.
 */
export function LoadingOverlay({
  visible,
  message,
  detail,
  action,
  corner,
  onHidden,
  label = 'Loading',
}: {
  visible: boolean;
  /** A short line under the logo, e.g. "You're offline". */
  message?: string;
  /** A quieter line under that. */
  detail?: string;
  /** A button under the message, e.g. Try again. */
  action?: Action;
  /** A small pill at the top-right, e.g. Skip. */
  corner?: Action;
  /** Called once it has finished fading out. */
  onHidden?: () => void;
  label?: string;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const fade = useSharedValue(visible ? 1 : 0);
  // showing again while it fades out (or after) puts it straight back on screen
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      fade.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
      return;
    }
    const done = () => {
      setMounted(false);
      onHidden?.();
    };
    fade.set(
      withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(done);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fade]);

  const style = useAnimatedStyle(() => ({ opacity: fade.get() }));
  if (!mounted) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.backdrop, style]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <LogoLoader size={72} />

      {message ? (
        <View style={styles.copy}>
          <Text style={styles.message}>{message}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
      ) : null}

      {action ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            action.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, webCursor, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}

      {corner ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            corner.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={corner.label}
          hitSlop={8}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.corner,
            { top: Math.max(insets.top, 12) + 8 },
            (hovered || pressed) && styles.cornerActive,
            pressed && { transform: [{ scale: 0.96 }] },
            webCursor,
          ]}
        >
          <Text style={styles.cornerText}>{corner.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // the page behind melts into one calm, even tone: blurred far enough that no card shows through as a patch, colours
  // muted so nothing competes, and a light warm wash over it all, so the full-colour logo is the one thing to look at
  backdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({
          backgroundColor: 'rgba(250, 247, 240, 0.35)',
          backdropFilter: 'blur(36px) saturate(70%)',
          WebkitBackdropFilter: 'blur(36px) saturate(70%)',
        } as object)
      : { backgroundColor: 'rgba(242, 239, 233, 0.97)' }),
  },
  copy: { alignItems: 'center', marginTop: 18, paddingHorizontal: 32 },
  message: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3, color: colors.ink, textAlign: 'center' },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft, textAlign: 'center', marginTop: 4 },
  action: { marginTop: 18, height: 42, paddingHorizontal: 22, borderRadius: 21, backgroundColor: '#0A1C3E', justifyContent: 'center' },
  actionText: { fontFamily: fonts.semibold, fontSize: 14, color: '#FFFFFF' },
  corner: {
    position: 'absolute',
    right: 16,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.08)',
  },
  cornerActive: { backgroundColor: '#FFFFFF' },
  cornerText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
