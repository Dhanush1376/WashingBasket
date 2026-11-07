import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const IN_MS = 420;
const OUT_MS = 300;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** App drawer: slides up from the bottom over a dimmed backdrop; tap outside to dismiss. */
export function BottomSheet({ visible, onClose, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.value = withTiming(1, { duration: IN_MS, easing: EASE });
    } else if (mounted) {
      // slide out first, then unmount (on a timer, so it never lingers if frames are throttled)
      t.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.cubic) });
      const id = setTimeout(() => setMounted(false), OUT_MS + 40);
      return () => clearTimeout(id);
    }
  }, [visible, mounted, t]);

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value * 0.45 }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - t.value) * 420 }] }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + (footer ? 14 : 20) }, sheet]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { backgroundColor: '#0B1220' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: Platform.OS === 'web' ? '90vh' : '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 10,
    paddingHorizontal: 24,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -12px 32px rgba(11, 18, 32, 0.14)' } as any)
      : { shadowColor: '#0B1220', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 24 }),
  },
  sheetScroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    flexGrow: 0,
    paddingBottom: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 3, backgroundColor: colors.line, marginBottom: 16 },
  sheetFooter: {
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
    backgroundColor: colors.background,
  },
});
