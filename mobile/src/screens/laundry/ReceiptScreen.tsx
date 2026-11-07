import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppScreen } from '../../components/app/AppScreen';
import { Icon } from '../../components/app/Icon';
import { Button } from '../../components/app/primitives';
import { EmptyState, ListSkeleton } from '../../components/app/states';
import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { haptic } from '../../lib/haptics';
import { money, plural, when } from '../../lib/format';
import { markAnimationShown, receiptHtml, receiptText, receiptView, type ReceiptView } from '../../mock/services/receiptService';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, fonts, space, text } from '../../theme';

const PRINT_MS = 2200;

/**
 * The order receipt. The first time it opens after staff accept the order it prints out of a slot, once; after that
 * it's simply there. Share sends the text; Download saves an HTML copy on the web (on a phone, Copy puts it on the clipboard).
 */
export function ReceiptScreen({ navigation, route }: ScreenProps<'Receipt'>) {
  const { orderId } = route.params;
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const [toast, setToast] = useState<string | null>(null);
  const v = state ? receiptView(state, orderId) : null;
  // decided once, on first render with data, so marking it shown doesn't cut the animation short
  const [animate, setAnimate] = useState<boolean | null>(null);
  if (v && animate === null) setAnimate(!v.receipt.animationShownAt);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  if (!state || !customer) {
    return (
      <AppScreen title="Receipt">
        <ListSkeleton rows={2} height={180} />
      </AppScreen>
    );
  }
  if (!v || v.order.customerId !== customer.id) {
    return (
      <AppScreen title="Receipt">
        <EmptyState icon="receipt" title="No receipt yet" message="Your receipt appears as soon as our staff accept the order." action={{ label: 'Back to order', onPress: () => navigation.goBack() }} />
      </AppScreen>
    );
  }

  const share = async () => {
    const message = receiptText(v);
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> }) : undefined;
        if (nav?.share) await nav.share({ title: `Receipt ${v.receipt.number}`, text: message });
        else {
          await Clipboard.setStringAsync(message);
          setToast('Receipt copied');
        }
      } else await Share.share({ title: `Receipt ${v.receipt.number}`, message });
    } catch {
      // the share sheet was dismissed
    }
  };

  const download = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([receiptHtml(v)], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `washing-basket-${v.receipt.number}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setToast('Receipt downloaded');
    } else {
      await Clipboard.setStringAsync(receiptText(v));
      setToast('Receipt copied');
    }
    haptic.success();
  };

  return (
    <AppScreen title="Receipt">
      <View style={styles.page}>
        <Printed view={v} animate={!!animate} onPrinted={() => markAnimationShown(v.receipt.id).catch(() => {})} />
        <View style={styles.actions}>
          <Button label="Share" icon="share" variant="outline" onPress={share} style={styles.flex} />
          <Button label={Platform.OS === 'web' ? 'Download' : 'Copy'} icon={Platform.OS === 'web' ? 'arrowRight' : 'copy'} onPress={download} style={styles.flex} />
        </View>
        <Button label="Track this order" variant="light" onPress={() => navigation.popTo('LaundryOrder', { orderId })} style={{ marginTop: space.sm }} />
        {toast ? (
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Icon name="check" size={14} color="#FFFFFF" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

/** The receipt paper, fed down out of a printer slot when `animate` is set. */
function Printed({ view, animate, onPrinted }: { view: ReceiptView; animate: boolean; onPrinted: () => void }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const feed = useSharedValue(animate && !reduced ? 0 : 1);
  const done = useRef(false);

  useEffect(() => {
    if (!height || done.current) return;
    done.current = true;
    if (animate && !reduced) {
      haptic.tap();
      // the paper feeds out of the slot, easing to a stop
      feed.value = withDelay(250, withTiming(1, { duration: PRINT_MS, easing: Easing.bezier(0.3, 0.1, 0.4, 1) }, (fin) => {
        if (fin) scheduleOnRN(onPrinted);
      }));
    } else if (animate) onPrinted();
  }, [height, animate, reduced, feed, onPrinted]);

  const paper = useAnimatedStyle(() => ({ transform: [{ translateY: (feed.value - 1) * (height || 600) }] }));
  const { order, receipt } = view;

  return (
    <View>
      <View style={styles.printer}>
        <View style={styles.printerLight} />
        <Text style={styles.printerText}>{animate ? 'Printing your receipt…' : 'Washing Basket'}</Text>
        <View style={styles.slot} />
      </View>
      <View style={styles.clip}>
        <Animated.View style={paper} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          <View style={styles.paper} accessible accessibilityLabel={`Receipt ${receipt.number} for order ${order.id}, total ${money(order.total)}`}>
            <Text style={styles.brand}>Washing Basket</Text>
            <Text style={[text.caption, styles.center]}>{view.location?.name}</Text>
            <Text style={[text.caption, styles.center]}>{view.location?.office.address}</Text>
            <Dashed />
            <Row k="Receipt" v={receipt.number} />
            <Row k="Order" v={order.id} />
            <Row k="Customer" v={view.customer?.name ?? ''} />
            <Row k="Service" v={view.mode} />
            <Row k="Submitted" v={when(order.createdAt)} />
            <Row k="Accepted" v={order.acceptedAt ? when(order.acceptedAt) : '—'} />
            {view.staff ? <Row k="Accepted by" v={view.staff.name} /> : null}
            <Dashed />
            {order.lines.map((l) => (
              <View key={l.itemId} style={styles.item}>
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{l.name}</Text>
                  <Text style={text.caption}>
                    {l.qty} × {money(l.unitPrice)} · {l.categoryName}
                  </Text>
                </View>
                <Text style={styles.mono}>{money(l.amount)}</Text>
              </View>
            ))}
            <Dashed />
            <Row k={`Subtotal · ${plural(order.pieces, 'piece')}`} v={money(order.subtotal)} />
            <Row k="Service charge" v={order.serviceCharge ? money(order.serviceCharge) : 'Free'} />
            <View style={[styles.item, { marginTop: space.sm }]}>
              <Text style={styles.totalK}>Total</Text>
              <Text style={styles.totalV}>{money(order.total)}</Text>
            </View>
            <Row k="Payment" v={`${view.payment} · wallet`} />
            {order.payment.txnId ? <Row k="Transaction" v={order.payment.txnId} /> : null}
            <Dashed />
            <View style={styles.stamp}>
              <Icon name="check" size={14} color="#0D7A21" strokeWidth={2.6} />
              <Text style={styles.stampText}>Accepted</Text>
            </View>
            <Text style={[text.caption, styles.center, { marginTop: space.md }]}>Thank you! Demo receipt from mock data, no real payment.</Text>
          </View>
          <Zigzag />
        </Animated.View>
      </View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

const Dashed = () => <View style={styles.dashed} />;

function Zigzag() {
  const teeth = 24;
  const w = 100 / teeth;
  let d = 'M0 0';
  for (let i = 0; i < teeth; i++) d += ` L${i * w + w / 2} 6 L${(i + 1) * w} 0`;
  return (
    <Svg width="100%" height={7} viewBox="0 0 100 7" preserveAspectRatio="none">
      <Path d={`${d} Z`} fill="#FFFFFF" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingTop: space.sm },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  printer: { height: 64, borderRadius: 20, backgroundColor: app.navyDeep, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, zIndex: 2 },
  printerLight: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3BE15A' },
  printerText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF', flex: 1 },
  slot: { position: 'absolute', left: 18, right: 18, bottom: 10, height: 5, borderRadius: 3, backgroundColor: '#000814' },
  clip: { overflow: 'hidden', marginTop: -12, marginHorizontal: 26, paddingTop: 0 },
  paper: { backgroundColor: '#FFFFFF', paddingHorizontal: space.lg, paddingTop: space.xl + 4, paddingBottom: space.lg, borderWidth: 1, borderBottomWidth: 0, borderColor: app.hairline },
  brand: { fontFamily: fonts.wordmark, fontSize: 22, color: colors.navy, textAlign: 'center' },
  dashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong, marginVertical: space.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md, paddingVertical: 3 },
  itemName: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  k: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkSoft },
  v: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  totalK: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  totalV: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: '#0D7A21', transform: [{ rotate: '-4deg' }] },
  stampText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#0D7A21' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999, backgroundColor: colors.ink },
  toastText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
});
