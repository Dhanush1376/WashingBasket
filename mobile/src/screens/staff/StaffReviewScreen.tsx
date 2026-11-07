import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Pop, Rise } from '../../components/app/motion';
import { Button, Card, Divider, KeyValue } from '../../components/app/primitives';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillTextArea } from '../../components/ui/SheetForm';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { haptic } from '../../lib/haptics';
import { date, money, plural, when } from '../../lib/format';
import { MODE_COPY } from '../../mock/engine/lifecycle';
import { findCustomer, findOrder, findReceipt } from '../../mock/engine/selectors';
import { acceptOrder, rejectOrder } from '../../mock/services/staffService';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, fonts, shape, space, text } from '../../theme';
import { StaffFrame } from './StaffFrame';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const REASONS = ['Item counts don’t match the order', 'Items need a service we don’t offer here', 'Damaged items the customer didn’t mention', 'Customer asked to cancel'];

/**
 * After a valid submission or pickup QR: the staff member counts the clothes against the order, then accepts it
 * (the customer's receipt is issued) or rejects it with a reason (the payment goes back to the customer's wallet).
 */
export function StaffReviewScreen({ navigation, route }: ScreenProps<'StaffReview'>) {
  const { orderId, qrId } = route.params;
  const state = useLaundryState();
  const me = useCurrentStaff();
  const [counted, setCounted] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<'accepted' | 'rejected' | null>(null);

  const order = state ? findOrder(state, orderId) : undefined;
  if (!state || !me) return <StaffFrame title="Review order">{null}</StaffFrame>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffFrame title="Review order">
        <EmptyState icon="alert" title="Not your location’s order" message="You can only process orders for your own location." action={{ label: 'Back to orders', onPress: () => navigation.popTo('StaffHome') }} />
      </StaffFrame>
    );
  }
  const customer = findCustomer(state, order.customerId);
  const isHome = order.serviceMode === 'HOME_PICKUP';
  const receipt = findReceipt(state, order.id);

  if (outcome) {
    const ok = outcome === 'accepted';
    return (
      <StaffFrame title={ok ? 'Order accepted' : 'Order rejected'} back={false}>
        <View style={styles.done}>
          <Pop from={0.5}>
            <View style={[styles.doneIcon, { backgroundColor: ok ? '#12AD2B' : colors.danger }]}>
              <Icon name={ok ? 'check' : 'x'} size={38} color="#FFFFFF" strokeWidth={2.6} />
            </View>
          </Pop>
          <Rise delay={120}>
            <Text style={styles.doneTitle}>{ok ? `${order.id} accepted` : `${order.id} rejected`}</Text>
            <Text style={[text.body, styles.center]}>
              {ok
                ? `${isHome ? 'Collected. ' : ''}Receipt ${receipt?.number ?? ''} is on the customer’s phone now.`
                : `${money(order.payment.amount)} went back to ${customer?.name ?? 'the customer'}’s wallet. Reason: ${order.rejectionReason}`}
            </Text>
          </Rise>
          <View style={styles.doneButtons}>
            <Button label="Scan next" icon="grid" onPress={() => navigation.replace('StaffScan', { intent: 'ANY' })} />
            <Button label={ok ? 'Open order' : 'Back to orders'} variant="outline" onPress={() => (ok ? navigation.replace('StaffOrder', { orderId: order.id }) : navigation.popTo('StaffHome'))} />
          </View>
        </View>
      </StaffFrame>
    );
  }

  if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') {
    return (
      <StaffFrame title="Review order">
        <EmptyState icon="info" title={`${order.id} isn’t waiting for acceptance`} message="It may have been handled already." action={{ label: 'Open order', onPress: () => navigation.replace('StaffOrder', { orderId: order.id }) }} />
      </StaffFrame>
    );
  }

  const accept = async () => {
    setBusy('accept');
    setError(null);
    try {
      await acceptOrder(order.id, me.staff.id, qrId);
      haptic.success();
      setOutcome('accepted');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t accept this order.');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy('reject');
    setError(null);
    try {
      await rejectOrder(order.id, me.staff.id, qrId, reason);
      haptic.success();
      setRejectOpen(false);
      setOutcome('rejected');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t reject this order.');
    } finally {
      setBusy(null);
    }
  };

  const footer = (
    <View style={{ gap: space.sm }}>
      {error && !rejectOpen ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <Button label="Reject" icon="x" variant="outline" onPress={() => setRejectOpen(true)} disabled={!!busy} style={styles.flex} />
        <Button label={isHome ? 'Accept & collect' : 'Accept order'} icon="check" onPress={accept} loading={busy === 'accept'} disabled={!counted} style={styles.grow} />
      </View>
    </View>
  );

  return (
    <StaffFrame title={`Review ${order.id}`} subtitle={`${MODE_COPY[order.serviceMode].label} · QR verified`} footer={footer}>
      <Rise>
        <View style={styles.verified}>
          <Icon name="shield" size={18} color="#0D7A21" />
          <Text style={[text.bodyStrong, styles.flex]}>Valid {isHome ? 'pickup' : 'drop-off'} QR · paid {money(order.payment.amount)} from wallet</Text>
        </View>
      </Rise>

      <Card style={styles.card}>
        <Text style={styles.kicker}>Customer</Text>
        <Text style={text.h1}>{customer?.name ?? 'Customer'}</Text>
        <Text style={text.caption}>{customer?.phone}</Text>
        {order.pickup ? (
          <View style={styles.pickup}>
            <Icon name="mapPin" size={16} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>
                {date(`${order.pickup.date}T00:00:00`)} · {order.pickup.slotLabel}
              </Text>
              <Text style={text.caption}>
                {order.pickup.address}
                {order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''} · {order.pickup.contactPhone}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={[text.caption, { marginTop: space.sm }]}>Requested {when(order.createdAt)}</Text>
      </Card>

      <Card style={styles.card}>
        <View style={styles.headRow}>
          <Text style={text.h2}>Count the clothes</Text>
          <Text style={styles.pieces}>{plural(order.pieces, 'piece')}</Text>
        </View>
        {order.lines.map((l) => (
          <View key={l.itemId} style={styles.line}>
            <GarmentIcon name={l.icon} size={38} />
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>{l.name}</Text>
              <Text style={text.caption}>{l.categoryName}</Text>
            </View>
            <Text style={styles.qty}>× {l.qty}</Text>
          </View>
        ))}
        <Divider style={{ marginVertical: space.md }} />
        <KeyValue label="Total paid" value={money(order.total)} strong />
        {order.instructions ? (
          <View style={styles.note}>
            <Icon name="info" size={14} color={colors.inkSoft} />
            <Text style={[text.caption, styles.flex]}>Customer note: {order.instructions}</Text>
          </View>
        ) : null}
      </Card>

      <Pressable
        onPress={() => {
          haptic.tap();
          setCounted((c) => !c);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: counted }}
        accessibilityLabel={`I counted ${plural(order.pieces, 'piece')} and ${order.pieces === 1 ? 'it matches' : 'they match'} the order`}
        style={[styles.check, counted && styles.checkOn, webCursor]}
      >
        <View style={[styles.box, counted && styles.boxOn]}>{counted ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}</View>
        <Text style={[text.bodyStrong, styles.flex]}>I counted {plural(order.pieces, 'piece')} and {order.pieces === 1 ? 'it matches' : 'they match'} the order.</Text>
      </Pressable>

      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        <Text style={text.h1}>Reject {order.id}?</Text>
        <Text style={[text.body, { marginTop: space.xs }]}>{money(order.payment.amount)} goes straight back to the customer’s wallet, and they’ll see your reason.</Text>
        <View style={styles.reasons}>
          {REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }} style={[styles.reason, reason === r && styles.reasonOn, webCursor]}>
              <Text style={[styles.reasonText, reason === r && { color: '#FFFFFF' }]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <PillTextArea value={reason} onChangeText={setReason} placeholder="Or write the reason" accessibilityLabel="Reason for rejecting" />
        {error && rejectOpen ? (
          <Text style={[styles.error, { marginTop: space.sm }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label="Reject & refund" variant="dark" onPress={reject} loading={busy === 'reject'} disabled={reason.trim().length < 3} style={{ marginTop: space.lg }} />
      </BottomSheet>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1.6 },
  center: { textAlign: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: shape.inner, backgroundColor: colors.successTint, marginTop: space.sm },
  card: { padding: space.lg, marginTop: space.md, borderWidth: 1, borderColor: app.hairline },
  kicker: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.inkMuted, marginBottom: 2 },
  pickup: { flexDirection: 'row', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: shape.inner, backgroundColor: app.navySoft },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
  pieces: { fontFamily: fonts.bold, fontSize: 16, color: colors.orange },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  qty: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', gap: 6, marginTop: space.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, marginTop: space.md, borderRadius: shape.tile, backgroundColor: app.cream, borderWidth: 1.5, borderColor: app.cream },
  checkOn: { backgroundColor: colors.successTint, borderColor: '#0D7A21' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.75, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: '#0D7A21', borderColor: '#0D7A21' },
  footerRow: { flexDirection: 'row', gap: space.sm },
  error: { ...text.caption, color: colors.danger },
  reasons: { gap: space.xs, marginVertical: space.lg },
  reason: { padding: space.md, borderRadius: shape.inner, backgroundColor: app.cream },
  reasonOn: { backgroundColor: colors.ink },
  reasonText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  done: { alignItems: 'center', paddingTop: space.xxxl, gap: space.md, maxWidth: 520, alignSelf: 'center', width: '100%' },
  doneIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { ...text.display, textAlign: 'center', marginBottom: space.xs },
  doneButtons: { width: '100%', gap: space.sm, marginTop: space.xl },
});
