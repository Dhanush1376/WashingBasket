import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillTextArea } from '../../components/ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { date, money, plural, when } from '../../lib/format';
import { MODE_COPY } from '../../mock/engine/lifecycle';
import { findCustomer, findOrder, findReceipt } from '../../mock/engine/selectors';
import { acceptOrder, rejectOrder } from '../../mock/services/staffService';
import type { ScreenProps } from '../../navigation/types';
import { canSeeContact, displayName } from '../../staff/work';
import { colors, fonts, space } from '../../theme';
import { Button, CHIP, Line, Notice, Outcome, Panel, shared, StaffPage, useStaff, webCursor } from './kit';

const REASONS = ['Item counts don’t match the order', 'Items need a service we don’t offer here', 'Damaged items the customer didn’t mention', 'Customer asked to cancel'];

/**
 * After a valid drop-off or pickup QR: count the clothes against the order, then accept it (the customer's receipt
 * is issued) or reject it with a reason (the payment goes back to the customer's wallet). The order system checks
 * the QR again on accept, so a code used elsewhere in the meantime is refused.
 */
export function StaffReviewScreen({ navigation, route }: ScreenProps<'StaffReview'>) {
  const { orderId, qrId } = route.params;
  const { state, me } = useStaff();
  const [counted, setCounted] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<'accepted' | 'rejected' | null>(null);

  const scanNext = () => navigation.navigate('StaffTabs', { screen: 'StaffScan', params: { intent: 'ANY', orderId: undefined, nonce: Date.now() } });
  const toOrders = () => navigation.navigate('StaffTabs', { screen: 'StaffOrders' });

  const order = state ? findOrder(state, orderId) : undefined;
  if (!state || !me) return <StaffPage title="Review order" tab={false} bell={false}>{null}</StaffPage>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffPage title="Review order" tab={false} bell={false}>
        <EmptyState icon="alert" title="Not your branch’s order" message="You can only accept orders for your own branch." action={{ label: 'Back to orders', onPress: toOrders }} />
      </StaffPage>
    );
  }
  const customer = findCustomer(state, order.customerId);
  const isHome = order.serviceMode === 'HOME_PICKUP';
  const receipt = findReceipt(state, order.id);
  const contact = canSeeContact(me.staff, order);
  const name = displayName(customer?.name ?? 'Customer', contact);

  if (outcome) {
    const ok = outcome === 'accepted';
    return (
      <StaffPage title={ok ? 'Order accepted' : 'Order rejected'} tab={false} bell={false}>
        <Outcome
          ok={ok}
          title={`${order.id} ${ok ? (isHome ? 'collected' : 'accepted') : 'rejected'}`}
          message={
            ok
              ? `Receipt ${receipt?.number ?? ''} is on ${name}’s phone now. ${isHome ? 'Bring the bag to the branch for washing.' : 'Tag the bag and put it in the wash queue.'}`
              : `${money(order.payment.amount)} went back to ${name}’s wallet. Reason: ${order.rejectionReason}`
          }
        >
          <Button label="Scan next" icon="scan" onPress={scanNext} />
          <Button label={ok ? 'Open order' : 'Back to orders'} variant="outline" onPress={() => (ok ? navigation.replace('StaffOrder', { orderId: order.id }) : toOrders())} />
        </Outcome>
      </StaffPage>
    );
  }

  if (order.status !== 'AWAITING_STAFF_ACCEPTANCE') {
    return (
      <StaffPage title="Review order" tab={false} bell={false}>
        <EmptyState icon="info" title={`${order.id} isn’t waiting for acceptance`} message="Someone may have handled it already." action={{ label: 'Open order', onPress: () => navigation.replace('StaffOrder', { orderId: order.id }) }} />
      </StaffPage>
    );
  }

  const accept = async () => {
    if (busy) return;
    setBusy('accept');
    setError(null);
    try {
      await acceptOrder(order.id, me.staff.id, qrId);
      haptic.success();
      setOutcome('accepted');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t accept this order. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (busy) return;
    setBusy('reject');
    setError(null);
    try {
      await rejectOrder(order.id, me.staff.id, qrId, reason.trim());
      haptic.success();
      setRejectOpen(false);
      setOutcome('rejected');
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t reject this order. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const confirmText = `I counted ${plural(order.pieces, 'piece')} and ${order.pieces === 1 ? 'it matches' : 'they match'} the order.`;

  return (
    <StaffPage
      title={`Review ${order.id}`}
      subtitle={`${MODE_COPY[order.serviceMode].label} · QR verified`}
      tab={false}
      bell={false}
      footer={
        <>
          {error && !rejectOpen ? (
            <Text style={shared.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={styles.footerRow}>
            <Button
              label="Reject"
              icon="x"
              variant="outline"
              onPress={() => setRejectOpen(true)}
              disabled={!!busy}
              style={[styles.flex, { height: 46, borderRadius: 23 }]}
            />
            <Button
              label={isHome ? 'Accept & collect' : 'Accept order'}
              icon="check"
              variant="dark"
              onPress={accept}
              loading={busy === 'accept'}
              disabled={!counted || !!busy}
              style={[styles.grow, { height: 46, borderRadius: 23 }]}
            />
          </View>
          {!counted ? <Text style={[shared.caption, styles.center]}>Tick the count below to accept.</Text> : null}
        </>
      }
    >
      <Rise>
        <Notice tone="ok" icon="shield" title={`Valid ${isHome ? 'pickup' : 'drop-off'} QR`}>
          Paid {money(order.payment.amount)} from wallet · requested {when(order.createdAt)}
        </Notice>
      </Rise>

      <Rise delay={60}>
        <Panel>
          <Text style={shared.kicker}>Customer</Text>
          <Text style={[shared.h1, { marginTop: 2 }]}>{name}</Text>
          {order.pickup ? (
            <View style={styles.pickup}>
              <Icon name="mapPin" size={16} color={colors.navy} />
              <View style={styles.flex}>
                <Text style={shared.strong}>
                  {date(`${order.pickup.date}T00:00:00`)} · {order.pickup.slotLabel}
                </Text>
                {contact ? (
                  <Text style={shared.caption}>
                    {order.pickup.address}
                    {order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </Panel>
      </Rise>

      <Rise delay={120}>
        <Panel>
          <View style={styles.headRow}>
            <Text style={shared.h2}>Count the clothes</Text>
            <Text style={styles.pieces}>{plural(order.pieces, 'piece')}</Text>
          </View>
          {order.lines.map((l) => (
            <View key={l.itemId} style={styles.line}>
              <View style={styles.art}>
                <GarmentIcon name={l.icon} size={30} />
              </View>
              <View style={styles.flex}>
                <Text style={shared.strong}>{l.name}</Text>
                <Text style={shared.caption}>{l.categoryName}</Text>
              </View>
              <Text style={styles.qty}>× {l.qty}</Text>
            </View>
          ))}
          <View style={shared.rule} />
          <Line label="Total paid" value={money(order.total)} strong />
          {order.instructions ? (
            <Notice tone="info" icon="info" style={{ marginTop: space.md }}>
              Customer note: {order.instructions}
            </Notice>
          ) : null}
        </Panel>
      </Rise>

      <Rise delay={180}>
        <Pressable
          onPress={() => {
            haptic.tap();
            setCounted((c) => !c);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: counted }}
          accessibilityLabel={confirmText}
          style={[styles.check, counted && styles.checkOn, webCursor]}
        >
          <View style={[styles.box, counted && styles.boxOn]}>{counted ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}</View>
          <Text style={[shared.strong, styles.flex, { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {confirmText}
          </Text>
        </Pressable>
      </Rise>
      <Text style={shared.caption}>If the count is off, reject with the reason. The customer is refunded straight away and can place a new order.</Text>

      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        <Text style={shared.h1}>Reject {order.id}?</Text>
        <Text style={[shared.body, { marginTop: space.xs }]}>{money(order.payment.amount)} goes straight back to the customer’s wallet, and they’ll see your reason.</Text>
        <View style={styles.reasons} accessibilityRole="radiogroup">
          {REASONS.map((r) => (
            <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }} style={[styles.reason, reason === r && styles.reasonOn, webCursor]}>
              <Text style={[styles.reasonText, reason === r && { color: '#FFFFFF' }]}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <PillTextArea value={reason} onChangeText={setReason} placeholder="Or write the reason" accessibilityLabel="Reason for rejecting" />
        {error && rejectOpen ? (
          <Text style={[shared.error, { marginTop: space.sm }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label="Reject & refund" variant="dark" onPress={reject} loading={busy === 'reject'} disabled={reason.trim().length < 3 || !!busy} style={{ marginTop: space.lg }} />
      </BottomSheet>
    </StaffPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flex: 1.6 },
  center: { textAlign: 'center' },
  pickup: { flexDirection: 'row', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: 16, backgroundColor: CHIP },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
  pieces: { fontFamily: fonts.bold, fontSize: 15, color: colors.orange },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  art: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F1EDE4', alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E4DA' },
  checkOn: { backgroundColor: '#EEF3FB', borderColor: '#0A1C3E' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.75, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: '#0A1C3E', borderColor: '#0A1C3E' },
  footerRow: { flexDirection: 'row', gap: space.sm },
  reasons: { gap: space.xs, marginVertical: space.lg },
  reason: { padding: space.md, borderRadius: 16, backgroundColor: CHIP },
  reasonOn: { backgroundColor: colors.ink },
  reasonText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
});
