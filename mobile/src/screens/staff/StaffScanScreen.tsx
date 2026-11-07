import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Button } from '../../components/app/primitives';
import { PillField } from '../../components/ui/SheetForm';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { haptic } from '../../lib/haptics';
import { QR_PURPOSE_COPY } from '../../mock/engine/lifecycle';
import { qrState } from '../../mock/engine/selectors';
import { qrPayload, scan, shortCode, type ScanResult } from '../../mock/services/qrService';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, fonts, shape, space, text } from '../../theme';
import { StaffFrame } from './StaffFrame';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/**
 * Scans a customer's QR with the camera (or takes the short code typed in) and checks it against the order system:
 * right location, right purpose, active, unused, unexpired. A valid code opens the next step; anything else says why.
 * In development builds a clearly labelled demo scanner lists the codes on screen, so the flow can be tried without a
 * second device.
 */
export function StaffScanScreen({ navigation, route }: ScreenProps<'StaffScan'>) {
  const intent = route.params?.intent ?? 'ANY';
  const expectOrderId = route.params?.orderId;
  const me = useCurrentStaff();
  const state = useLaundryState();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Extract<ScanResult, { ok: false }> | null>(null);
  const [code, setCode] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const last = useRef<{ raw: string; at: number } | null>(null);

  useEffect(() => {
    let alive = true;
    CameraView.isAvailableAsync()
      .then((ok) => alive && setCameraOk(ok))
      .catch(() => alive && setCameraOk(false));
    return () => {
      alive = false;
    };
  }, []);

  const check = useCallback(
    async (raw: string) => {
      if (!me || checking) return;
      const now = Date.now();
      if (last.current && last.current.raw === raw && now - last.current.at < 3000) return; // the camera fires repeatedly
      last.current = { raw, at: now };
      setChecking(true);
      setResult(null);
      try {
        const r = await scan(raw, me.staff.id, intent, expectOrderId);
        if (r.ok) {
          haptic.success();
          setCode('');
          if (r.kind === 'INTAKE') navigation.replace('StaffReview', { orderId: r.orderId, qrId: r.qrId });
          else navigation.replace('StaffDelivery', { orderId: r.orderId, qrId: r.qrId });
        } else {
          haptic.error();
          setResult(r);
        }
      } catch (e) {
        haptic.error();
        setResult({ ok: false, code: 'ERROR', reason: e instanceof Error ? e.message : 'Couldn’t check this code.' });
      } finally {
        setChecking(false);
      }
    },
    [me, checking, intent, expectOrderId, navigation],
  );

  const title = intent === 'INTAKE' ? 'Scan to accept' : intent === 'DELIVERY' ? 'Scan delivery QR' : 'Scan QR';
  const granted = permission?.granted;

  // codes the demo scanner can "see": active codes at this location (or, to try the location check, elsewhere)
  const demoCodes =
    __DEV__ && state && me
      ? state.qrTokens
          .filter((q) => (showOthers ? q.locationId !== me.location.id : q.locationId === me.location.id))
          .filter((q) => ['ACTIVE', 'EXPIRED', 'CONSUMED'].includes(qrState(q, new Date().toISOString())))
          .filter((q) => (expectOrderId && !showOthers ? q.orderId === expectOrderId : true))
          .sort((a, b) => Date.parse(b.activatedAt ?? b.createdAt) - Date.parse(a.activatedAt ?? a.createdAt))
          .slice(0, 8)
      : [];

  return (
    <StaffFrame title={title} subtitle={me ? `${me.location.name}${expectOrderId ? ` · ${expectOrderId}` : ''}` : undefined}>
      <View style={styles.viewfinder}>
        {cameraOk && granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={checking ? undefined : (r) => check(r.data)}
          />
        ) : (
          <View style={styles.noCamera}>
            <Icon name="grid" size={34} color="rgba(255,255,255,0.8)" />
            <Text style={styles.noCameraTitle}>{cameraOk === false ? 'No camera available' : granted === false && !permission?.canAskAgain ? 'Camera access is off' : 'Camera access needed'}</Text>
            <Text style={styles.noCameraText}>
              {cameraOk === false
                ? 'Type the code under the customer’s QR instead.'
                : granted === false && !permission?.canAskAgain
                  ? 'Turn on camera access for Washing Basket in your device settings, or type the code below.'
                  : 'Allow the camera to scan customer QR codes.'}
            </Text>
            {cameraOk !== false && (permission?.canAskAgain ?? true) ? <Button label="Allow camera" icon="check" onPress={() => requestPermission()} style={{ marginTop: space.lg }} /> : null}
          </View>
        )}
        <View style={styles.frame} pointerEvents="none">
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c]]} />
          ))}
        </View>
        {checking ? (
          <View style={styles.checking}>
            <Text style={styles.checkingText}>Checking code…</Text>
          </View>
        ) : null}
      </View>

      {result ? (
        <View style={styles.refused} accessibilityRole="alert">
          <View style={styles.refusedIcon}>
            <Icon name="x" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={styles.refusedTitle}>Code not accepted</Text>
            <Text style={text.body}>{result.reason}</Text>
            {result.orderId && result.code !== 'WRONG_LOCATION' ? (
              <Pressable onPress={() => navigation.navigate('StaffOrder', { orderId: result.orderId! })} accessibilityRole="button" style={webCursor}>
                <Text style={[styles.link, { marginTop: space.xs }]}>Open {result.orderId}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Or type the code under the QR</Text>
      <View style={styles.manual}>
        <View style={styles.flex}>
          <PillField
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
            placeholder="ABCDE-12345"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="QR code"
            onSubmitEditing={() => code && check(code)}
          />
        </View>
        <Button label="Check" onPress={() => check(code)} disabled={code.replace(/-/g, '').length < 10} loading={checking} />
      </View>

      {__DEV__ ? (
        <View style={styles.demo}>
          <View style={styles.demoHead}>
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV ONLY</Text>
            </View>
            <Text style={[text.bodyStrong, styles.flex]}>Demo scanner</Text>
          </View>
          <Text style={text.caption}>Simulates pointing the camera at a customer’s screen. Not in production builds.</Text>
          <View style={styles.demoToggle}>
            {[false, true].map((o) => (
              <Pressable key={String(o)} onPress={() => setShowOthers(o)} accessibilityRole="tab" accessibilityState={{ selected: showOthers === o }} style={[styles.toggle, showOthers === o && styles.toggleOn, webCursor]}>
                <Text style={[styles.toggleText, showOthers === o && { color: '#FFFFFF' }]}>{o ? 'Other locations' : 'This location'}</Text>
              </Pressable>
            ))}
          </View>
          {demoCodes.length ? (
            demoCodes.map((q) => {
              const st = qrState(q, new Date().toISOString());
              return (
                <Pressable
                  key={q.id}
                  onPress={() => {
                    last.current = null;
                    check(qrPayload(q));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Simulate scanning ${q.orderId} ${QR_PURPOSE_COPY[q.purpose].label}`}
                  style={({ pressed }) => [styles.demoRow, webCursor, pressed && { opacity: 0.85 }]}
                >
                  <Icon name="grid" size={16} color={colors.navy} />
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>
                      {q.orderId} · {QR_PURPOSE_COPY[q.purpose].label}
                    </Text>
                    <Text style={text.caption}>
                      {shortCode(q.token)} · {st === 'ACTIVE' ? 'active' : st === 'CONSUMED' ? 'already used' : 'expired'}
                    </Text>
                  </View>
                  <Text style={styles.link}>Scan</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[text.caption, { marginTop: space.sm }]}>No codes to scan here yet. Pay for an order in the customer app to unlock one.</Text>
          )}
        </View>
      ) : null}
    </StaffFrame>
  );
}

const C = 30;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  viewfinder: { width: '100%', maxWidth: 520, alignSelf: 'center', aspectRatio: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0B0F17', marginTop: space.sm },
  noCamera: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  noCameraTitle: { fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF', marginTop: space.md, textAlign: 'center' },
  noCameraText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: space.xs },
  frame: { position: 'absolute', top: '14%', left: '14%', right: '14%', bottom: '14%' },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.orange },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  checking: { position: 'absolute', bottom: space.lg, alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  checkingText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  refused: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: shape.tile, backgroundColor: colors.dangerTint, marginTop: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  refusedIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  refusedTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger, marginBottom: 2 },
  label: { ...text.label, marginTop: space.xl, marginBottom: space.sm, maxWidth: 520, width: '100%', alignSelf: 'center' },
  manual: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: 520, width: '100%', alignSelf: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  demo: { marginTop: space.xxl, padding: space.lg, borderRadius: shape.tile, borderWidth: 1.5, borderStyle: 'dashed', borderColor: app.warning, backgroundColor: app.warningTint, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demoHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  devBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: app.warning },
  devBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: '#FFFFFF' },
  demoToggle: { flexDirection: 'row', gap: space.xs, marginTop: space.md, marginBottom: space.xs },
  toggle: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.7)' },
  toggleOn: { backgroundColor: colors.ink },
  toggleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginTop: space.sm, borderRadius: shape.inner, backgroundColor: '#FFFFFF' },
});
