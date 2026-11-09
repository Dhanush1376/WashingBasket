import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/app/Icon';
import { colors, fonts, space } from '../../theme';
import { Button, webCursor } from './kit';

const SHADE = 'rgba(6, 10, 20, 0.62)';

/**
 * The camera, over the whole screen: a dark shade with a clear square to aim at, the light and close buttons on
 * top, and a hint underneath. It hands the first code it reads back and closes; the scan page checks it.
 */
export function ScannerModal({ visible, title, onClose, onCode }: { visible: boolean; title: string; onClose: () => void; onCode: (raw: string) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let alive = true;
    CameraView.isAvailableAsync()
      .then((ok) => alive && setCameraOk(ok))
      .catch(() => alive && setCameraOk(false));
    return () => {
      alive = false;
    };
  }, []);

  // every opening starts fresh
  const [seen, setSeen] = useState(visible);
  if (visible !== seen) {
    setSeen(visible);
    if (visible) {
      setReady(false);
      setTorch(false);
    }
  }
  useEffect(() => {
    if (visible) done.current = false;
  }, [visible]);

  if (!visible) return null;

  const granted = !!permission?.granted;
  const blocked = !granted && !!permission && !permission.canAskAgain;
  const live = cameraOk !== false && granted;
  const box = Math.round(Math.min(width * 0.72, 300, height * 0.42));
  const top = Math.round((height - box) / 2 - 24);

  const read = (raw: string) => {
    if (done.current) return; // the camera reports the same code many times a second
    done.current = true;
    setTorch(false);
    onCode(raw);
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        {live ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onCameraReady={() => setReady(true)}
            onMountError={() => setCameraOk(false)}
            onBarcodeScanned={(r) => read(r.data)}
          />
        ) : null}

        {/* the shade, with a clear square to aim at */}
        <View style={[styles.shade, { height: top }]} pointerEvents="none" />
        <View style={{ flexDirection: 'row', height: box }} pointerEvents="none">
          <View style={[styles.shade, { flex: 1 }]} />
          <View style={{ width: box, height: box }}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
            {live && ready ? <ScanLine /> : null}
            {!live ? (
              <View style={styles.offBox}>
                <Icon name={cameraOk === false ? 'alert' : 'lock'} size={30} color="rgba(255,255,255,0.9)" />
              </View>
            ) : null}
          </View>
          <View style={[styles.shade, { flex: 1 }]} />
        </View>
        <View style={[styles.shade, { flex: 1 }]} pointerEvents="none" />

        {/* top: close, title, light */}
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close camera" hitSlop={8} style={({ pressed }) => [styles.round, webCursor, pressed && { opacity: 0.7 }]}>
            <Icon name="x" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {live ? (
            <Pressable onPress={() => setTorch((t) => !t)} accessibilityRole="switch" accessibilityState={{ checked: torch }} accessibilityLabel="Flashlight" hitSlop={8} style={({ pressed }) => [styles.round, torch && styles.roundOn, webCursor, pressed && { opacity: 0.8 }]}>
              <Icon name="flash" size={18} color={torch ? colors.ink : '#FFFFFF'} strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.roundGhost} />
          )}
        </View>

        {/* under the square: fallback when camera is not available or blocked */}
        {!live ? (
          <View style={[styles.below, { top: top + box + space.xl }]}>
            <Text style={styles.offTitle}>{cameraOk === false ? 'No camera on this device' : blocked ? 'Camera access is off' : 'Allow the camera to scan'}</Text>
            <Text style={styles.sub}>
              {cameraOk === false
                ? 'Close this and type the code printed under the customer’s QR.'
                : blocked
                  ? 'Turn on camera access for Washing Basket in your phone’s settings.'
                  : 'Washing Basket uses the camera only to read customer QR codes.'}
            </Text>
            {cameraOk !== false ? (
              blocked && Platform.OS !== 'web' ? (
                <Button label="Open settings" variant="light" onPress={() => Linking.openSettings().catch(() => {})} style={styles.allow} />
              ) : !blocked ? (
                <Button label="Allow camera" variant="primary" onPress={() => requestPermission()} style={styles.allow} />
              ) : null
            ) : null}
          </View>
        ) : null}

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.typeBtn, webCursor, pressed && { opacity: 0.8 }]}>
            <Icon name="edit" size={15} color="#FFFFFF" />
            <Text style={styles.typeText}>Type the code instead</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** A soft orange line sweeping the square while the camera looks for a code. Still when motion is reduced. */
function ScanLine() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t, reduced]);
  const anim = useAnimatedStyle(() => ({ top: `${6 + t.value * 88}%` }));
  return <Animated.View style={[styles.line, reduced && { top: '50%' }, anim]} />;
}

const C = 34;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05080F' },
  shade: { backgroundColor: SHADE },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.orange },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  line: { position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 1, backgroundColor: colors.orange, opacity: 0.95 },
  offBox: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },

  topBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  roundOn: { backgroundColor: '#FFFFFF' },
  roundGhost: { width: 44, height: 44 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' },

  below: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.95)' },
  hintDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12AD2B' },
  hintText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: space.md, maxWidth: 300 },
  offTitle: { fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF', textAlign: 'center' },
  allow: { marginTop: space.lg, minWidth: 190 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  typeText: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#FFFFFF' },
});
