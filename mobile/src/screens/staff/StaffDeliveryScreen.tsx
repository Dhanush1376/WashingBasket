import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Rise } from '../../components/app/motion';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { haptic } from '../../lib/haptics';
import { plural, when } from '../../lib/format';
import { MODE_COPY } from '../../mock/engine/lifecycle';
import { findCustomer, findOrder, openIssueFor } from '../../mock/engine/selectors';
import { confirmDelivery } from '../../mock/services/staffService';
import type { ScreenProps } from '../../navigation/types';
import { canSeeContact, displayName } from '../../staff/work';
import { colors, fonts, space } from '../../theme';
import { BEIGE, Button, Notice, Outcome, Panel, shared, StaffPage, useStaff } from './kit';

/**
 * After a valid delivery QR: the customer has checked their clothes on their own phone, and the staff member
 * completes the handover. The QR is used up on confirm, so it can't close the order twice.
 */
export function StaffDeliveryScreen({ navigation, route }: ScreenProps<'StaffDelivery'>) {
  const { orderId, qrId } = route.params;
  const { state, me } = useStaff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const scanNext = () => navigation.navigate('StaffTabs', { screen: 'StaffScan', params: { intent: 'ANY', orderId: undefined, nonce: Date.now() } });
  const toOrders = () => navigation.navigate('StaffTabs', { screen: 'StaffOrders' });

  const order = state ? findOrder(state, orderId) : undefined;
  if (!state || !me) return <StaffPage title="Complete delivery" tab={false} bell={false}>{null}</StaffPage>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffPage title="Complete delivery" tab={false} bell={false}>
        <EmptyState icon="alert" title="Not your branch’s order" message="You can only hand over orders for your own branch." action={{ label: 'Back to orders', onPress: toOrders }} />
      </StaffPage>
    );
  }
  const customer = findCustomer(state, order.customerId);
  const isHome = order.serviceMode === 'HOME_PICKUP';
  const name = displayName(customer?.name ?? 'the customer', canSeeContact(me.staff, order));
  const issue = openIssueFor(state, order.id);

  if (done || order.status === 'DELIVERED') {
    return (
      <StaffPage title={isHome ? 'Delivered' : 'Collected'} tab={false} bell={false}>
        <Outcome ok title={`${order.id} ${isHome ? 'delivered' : 'collected'}`} message={`All ${plural(order.pieces, 'piece')} handed to ${name}. The order is complete.`}>
          <Button label="Scan next" icon="scan" onPress={scanNext} />
          <Button label="Back to orders" variant="outline" onPress={toOrders} />
        </Outcome>
      </StaffPage>
    );
  }

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmDelivery(order.id, me.staff.id, qrId);
      haptic.success();
      setDone(true);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t complete the delivery. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verified = !!order.verification;

  return (
    <StaffPage
      title="Complete delivery"
      subtitle={`${order.id} · ${MODE_COPY[order.serviceMode].label}`}
      tab={false}
      bell={false}
      footer={
        <>
          {error ? (
            <Text style={shared.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            label={isHome ? 'Confirm delivered' : 'Confirm collected'}
            icon="check"
            variant="dark"
            style={{ height: 46, borderRadius: 23 }}
            onPress={confirm}
            loading={busy}
            disabled={!verified || !!issue || busy}
          />
        </>
      }
    >
      <Rise>
        {verified ? (
          <Notice tone="ok" icon="shield" title="Customer checked their clothes">
            {name} confirmed all {order.verification!.piecesConfirmed} pieces · {when(order.verification!.confirmedAt)}
          </Notice>
        ) : (
          <Notice tone="warn" icon="clock" title="Waiting for the customer">
            Ask {name} to check the clothes and tap “All here” in their app. Then confirm.
          </Notice>
        )}
      </Rise>
      {issue ? (
        <Rise delay={40}>
          <Notice tone="danger" icon="alert" title="An issue is open on this order">
            {issue.note || 'Resolve it from the order before handing over.'}
          </Notice>
        </Rise>
      ) : null}

      <Rise delay={80}>
        <Panel>
          <View style={styles.headRow}>
            <Text style={shared.h2}>Handing over</Text>
            <Text style={styles.pieces}>{plural(order.pieces, 'piece')}</Text>
          </View>
          {order.lines.map((l) => (
            <View key={l.itemId} style={styles.line}>
              <View style={styles.art}>
                <GarmentIcon name={l.icon} size={28} />
              </View>
              <Text style={[shared.strong, styles.flex]}>{l.name}</Text>
              <Text style={styles.qty}>× {l.qty}</Text>
            </View>
          ))}
        </Panel>
      </Rise>
      <Text style={shared.caption}>Confirming uses up the customer’s delivery QR. It can’t be used again.</Text>
    </StaffPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
  pieces: { fontFamily: fonts.bold, fontSize: 15, color: colors.orange },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  art: { width: 40, height: 40, borderRadius: 13, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
});
