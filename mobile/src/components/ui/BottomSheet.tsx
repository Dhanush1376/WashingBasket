import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAnimatedKeyboardSafe } from "../../hooks/useAnimatedKeyboardSafe";
import { colors, radius } from "../../theme";
import { useSheetPortal } from "./SheetPortal";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const IN_MS = 420;
const OUT_MS = 300;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Same gap between the drawer's last control and the keys as the sign-in sheet. */
const BOTTOM_GAP = 14;

/**
 * App drawer: slides up from the bottom over a dimmed backdrop; tap outside to dismiss.
 *
 * Keyboard (same as the sign-in sheet): on iOS the drawer follows the keyboard frame by frame and sits right on
 * top of the keys, and the drawer's own paper carries on underneath them. The iOS keyboard is see-through, so
 * with the dimmed backdrop behind it it looked dark and muddy; with the drawer behind it, it reads light and clean.
 *
 * Android gets the same lift, but draws the drawer in the app's own window (SheetPortal) rather than a Modal.
 * Android's Modal windows don't resize for the keyboard and hide it from the app, so fields ended up under the keys.
 */
export function BottomSheet({ visible, onClose, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.value = withTiming(1, { duration: IN_MS, easing: EASE });
    } else if (mounted) {
      // slide out first, then unmount (on a timer, so it never lingers if frames are throttled)
      t.value = withTiming(0, {
        duration: OUT_MS,
        easing: Easing.in(Easing.cubic),
      });
      const id = setTimeout(() => setMounted(false), OUT_MS + 40);
      return () => clearTimeout(id);
    }
  }, [visible, mounted, t]);

  // The keyboard's height includes the home-indicator / navigation-bar area, which the drawer's bottom padding
  // already covers, so lift by the rest. The web has no on-screen keyboard to follow.
  const kb = useAnimatedKeyboardSafe();
  const bottomInset = insets.bottom;
  const ios = Platform.OS === "ios";
  const android = Platform.OS === "android";
  const native = ios || android;
  const lift = useDerivedValue(() =>
    native ? Math.max(0, kb.height.value - bottomInset) : 0,
  );

  // Android Back closes the drawer
  useEffect(() => {
    if (!android || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [android, visible, onClose]);

  // Web Escape key closes the drawer
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  const backdrop = useAnimatedStyle(() => ({ opacity: t.value * 0.45 }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - t.value) * 420 - lift.value }],
    ...(native ? { maxHeight: Math.max(240, winH * 0.9 - lift.value) } : null),
  }));

  const overlay = !mounted ? null : (
    <View style={styles.fill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + BOTTOM_GAP },
          sheet,
        ]}
        accessibilityViewIsModal
      >
        {/* the drawer's paper, carried on below its bottom edge: what shows through the keyboard */}
        {native ? <View style={styles.underKeys} pointerEvents="none" /> : null}
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
    </View>
  );

  useSheetPortal(overlay);
  return null;
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: { backgroundColor: "#0B1220" },
  sheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: Platform.OS === "web" ? "90vh" : "90%",
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 10,
    paddingHorizontal: 24,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 -12px 32px rgba(11, 18, 32, 0.14)" } as any)
      : {
          shadowColor: "#0B1220",
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.14,
          shadowRadius: 20,
          elevation: 24,
        }),
  },
  underKeys: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    height: 1200,
    backgroundColor: colors.background,
  },
  sheetScroll: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    flexGrow: 0,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 3,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  sheetFooter: {
    width: "100%",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0ECE4",
    backgroundColor: colors.background,
  },
});
