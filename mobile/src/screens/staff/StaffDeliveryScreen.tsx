import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Pop, Rise } from '../../components/app/motion';
import { Button, Card } from '../../components/app/primitives';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { haptic } from '../../lib/haptics';
import { plural, when } from '../../lib/format';
import { findCustomer, findOrder } from '../../mock/engine/selectors';
import { confirmDelivery } from '../../mock/services/staffService';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, shape, space, text } from '../../theme';
import { StaffFrame } from './StaffFrame';

/** After a valid delivery QR: the customer's own confirmation, then the staff member completes the delivery. */
export function StaffDeliveryScreen({ navigation, route }: ScreenProps<'StaffDelivery'>) {
  const { orderId, qrId } = route.params;
  const state = useLaundryState();
  const me = useCurrentStaff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const order = state ? findOrder(state, orderId) : undefined;
  if (!state || !me) return <StaffFrame title="Complete delivery">{null}</StaffFrame>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffFrame title="Complete delivery">
        <EmptyState icon="alert" title="Not your location’s order" message="You can only process orders for your own location." action={{ label: 'Back to orders', onPress: () => navigation.popTo('StaffHome') }} />
      </StaffFrame>
    );
  }
  const customer = findCustomer(state, order.customerId);
  const isHome = order.serviceMode === 'HOME_PICKUP';

  if (done || order.status === 'DELIVERED') {
    return (
      <StaffFrame title="Delivered" back={false}>
        <View style={styles.done}>
          <Pop from={0.5}>
            <View style={styles.doneIcon}>
              <Icon name="check" size={38} color="#FFFFFF" strokeWidth={2.6} />
            </View>
          </Pop>
          <Rise delay={120}>
            <Text style={styles.doneTitle}>{order.id} {isHome ? 'delivered' : 'collected'}</Text>
            <Text style={[text.body, styles.center]}>All {plural(order.pieces, 'piece')} handed to {customer?.name ?? 'the customer'}. The order is complete.</Text>
          </Rise>
          <View style={styles.buttons}>
            <Button label="Scan next" icon="grid" onPress={() => navigation.replace('StaffScan', { intent: 'ANY' })} />
            <Button label="Back to orders" variant="outline" onPress={() => navigation.popTo('StaffHome')} />
          </View>
        </View>
      </StaffFrame>
    );
  }

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmDelivery(order.id, me.staff.id, qrId);
      haptic.success();
      setDone(true);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t complete the delivery.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StaffFrame
      title="Complete delivery"
      subtitle={`${order.id} · ${customer?.name ?? ''}`}
      footer={
        <View>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button label={isHome ? 'Confirm delivered' : 'Confirm collected'} icon="check" onPress={confirm} loading={busy} />
        </View>
      }
    >
      <Rise>
        <Card style={styles.verified}>
          <View style={styles.vIcon}>
            <Icon name="shield" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={text.h2}>Customer verified their clothes</Text>
            <Text style={text.body}>
              {order.verification ? `${customer?.name ?? 'The customer'} confirmed all ${order.verification.piecesConfirmed} pieces · ${when(order.verification.confirmedAt)}` : 'Waiting for the customer’s confirmation.'}
            </Text>
          </View>
        </Card>
      </Rise>
      <Card style={styles.card}>
        <Text style={[text.h2, { marginBottom: space.sm }]}>Handing over · {plural(order.pieces, 'piece')}</Text>
        {order.lines.map((l) => (
          <View key={l.itemId} style={styles.line}>
            <GarmentIcon name={l.icon} size={34} />
            <Text style={[text.bodyStrong, styles.flex]}>{l.name}</Text>
            <Text style={styles.qty}>× {l.qty}</Text>
          </View>
        ))}
      </Card>
      <Text style={[text.caption, { marginTop: space.md }]}>Confirming uses the customer’s delivery QR. It can’t be used again.</Text>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  verified: { flexDirection: 'row', gap: space.md, padding: space.lg, marginTop: space.sm, backgroundColor: colors.successTint },
  vIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0D7A21', alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.lg, marginTop: space.md, borderWidth: 1, borderColor: app.hairline, borderRadius: shape.card },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  qty: { ...text.amount, fontSize: 16 },
  error: { ...text.caption, color: colors.danger, marginBottom: space.sm },
  done: { alignItems: 'center', paddingTop: space.xxxl, gap: space.md, maxWidth: 520, alignSelf: 'center', width: '100%' },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#12AD2B', alignItems: 'center', justifyContent: 'center' },
  doneTitle: { ...text.display, textAlign: 'center', marginBottom: space.xs },
  buttons: { width: '100%', gap: space.sm, marginTop: space.xl },
});
