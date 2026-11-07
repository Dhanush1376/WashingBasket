import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Button, Card, Divider, KeyValue, StatusBadge } from '../../components/app/primitives';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { OrderTimeline } from '../../components/laundry/OrderTimeline';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { TONE } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { date, money, plural, when } from '../../lib/format';
import { MODE_COPY, PAYMENT_COPY, QR_PURPOSE_COPY, STATUS_COPY } from '../../mock/engine/lifecycle';
import { activitiesFor, findCustomer, findOrder, findReceipt, findStaff, openIssueFor } from '../../mock/engine/selectors';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, fonts, shape, space, text } from '../../theme';
import { StaffFrame } from './StaffFrame';
import { nextAction, runAction, staffHint } from './staffActions';

/** One order, for staff at its location: who, what, where it stands, its next step, and everything that happened. */
export function StaffOrderScreen({ navigation, route }: ScreenProps<'StaffOrder'>) {
  const { orderId } = route.params;
  const state = useLaundryState();
  const me = useCurrentStaff();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = state ? findOrder(state, orderId) : undefined;
  if (!state || !me) return <StaffFrame title={orderId}>{null}</StaffFrame>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffFrame title={orderId}>
        <EmptyState icon="alert" title="Not your location’s order" message="You can only see and process orders for your own location." action={{ label: 'Back to orders', onPress: () => navigation.popTo('StaffHome') }} />
      </StaffFrame>
    );
  }

  const customer = findCustomer(state, order.customerId);
  const status = STATUS_COPY[order.status];
  const action = nextAction(state, order, me.staff);
  const issue = openIssueFor(state, order.id);
  const receipt = findReceipt(state, order.id);
  const hint = staffHint(state, order);
  const qrs = state.qrTokens.filter((q) => q.orderId === order.id);
  const log = activitiesFor(state, order.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const act = async () => {
    if (!action) return;
    if (action.kind === 'scan-intake') return navigation.navigate('StaffScan', { intent: 'INTAKE', orderId: order.id });
    if (action.kind === 'scan-delivery') return navigation.navigate('StaffScan', { intent: 'DELIVERY', orderId: order.id });
    setBusy(true);
    setError(null);
    try {
      await runAction(action.kind, order.id, me.staff.id);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(false);
    }
  };

  const footer = action ? (
    <View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={action.label} icon={action.icon} variant={action.kind.startsWith('scan') ? 'primary' : 'dark'} onPress={act} loading={busy} />
    </View>
  ) : undefined;

  return (
    <StaffFrame title={order.id} subtitle={`${MODE_COPY[order.serviceMode].label} · ${me.location.shortName}`} right={<StatusBadge label={status.label} tone={TONE[status.tone]} />} footer={footer}>
      <View style={styles.grid}>
        <View style={styles.col}>
          {hint ? (
            <Rise>
              <View style={[styles.hint, issue && { backgroundColor: colors.dangerTint }]}>
                <Icon name={issue ? 'alert' : 'info'} size={16} color={issue ? colors.danger : colors.navy} />
                <Text style={[text.bodyStrong, styles.flex]}>{hint}</Text>
              </View>
            </Rise>
          ) : null}
          {issue ? (
            <Card style={[styles.card, { borderColor: colors.danger }]}>
              <Text style={text.h2}>Open issue</Text>
              <Text style={[text.body, { marginTop: 4 }]}>{issue.mismatches.length ? issue.mismatches.map((m) => `${m.name}: ${m.received} of ${m.expected} received`).join(' · ') : issue.note}</Text>
              {issue.note && issue.mismatches.length ? <Text style={[text.caption, { marginTop: 4 }]}>“{issue.note}”</Text> : null}
              <Text style={[text.caption, { marginTop: space.sm }]}>Reported {when(issue.reportedAt)}. An admin resolves it in the portal; delivery waits until then.</Text>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Text style={styles.kicker}>Customer</Text>
            <Text style={text.h2}>{customer?.name}</Text>
            <Text style={text.caption}>{customer?.phone}</Text>
            {order.pickup ? (
              <Text style={[text.body, { marginTop: space.sm }]}>
                {date(`${order.pickup.date}T00:00:00`)} · {order.pickup.slotLabel}
                {'\n'}
                {order.pickup.address}
                {order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''} · {order.pickup.contactPhone}
              </Text>
            ) : null}
            {order.instructions ? <Text style={[text.caption, { marginTop: space.sm }]}>Note: {order.instructions}</Text> : null}
          </Card>

          <Card style={styles.card}>
            <View style={styles.headRow}>
              <Text style={text.h2}>Items</Text>
              <Text style={styles.pieces}>{plural(order.pieces, 'piece')}</Text>
            </View>
            {order.lines.map((l) => (
              <View key={l.itemId} style={styles.line}>
                <GarmentIcon name={l.icon} size={34} />
                <Text style={[text.bodyStrong, styles.flex]}>{l.name}</Text>
                <Text style={styles.qty}>× {l.qty}</Text>
              </View>
            ))}
            <Divider style={{ marginVertical: space.md }} />
            <KeyValue label="Total" value={money(order.total)} strong />
            <KeyValue label="Payment" value={PAYMENT_COPY[order.payment.status].label} />
            {receipt ? <KeyValue label="Receipt" value={receipt.number} /> : null}
            {order.verification ? <KeyValue label="Customer confirmed" value={`${order.verification.piecesConfirmed} pieces · ${when(order.verification.confirmedAt)}`} /> : null}
          </Card>
        </View>

        <View style={styles.col}>
          <Card style={styles.card}>
            <Text style={[text.h2, { marginBottom: space.md }]}>Progress</Text>
            <OrderTimeline order={order} state={state} />
          </Card>

          <Card style={styles.card}>
            <Text style={[text.h2, { marginBottom: space.sm }]}>QR codes</Text>
            {qrs.map((q) => (
              <View key={q.id} style={styles.qrRow}>
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>{QR_PURPOSE_COPY[q.purpose].label}</Text>
                  <Text style={text.caption}>
                    {q.status.toLowerCase()}
                    {q.consumedAt ? ` · used ${when(q.consumedAt)}${q.consumedBy ? ` by ${findStaff(state, q.consumedBy)?.name ?? q.consumedBy}` : ''}` : ''}
                    {q.revokeReason ? ` · ${q.revokeReason}` : ''}
                    {q.scans.length ? ` · ${plural(q.scans.length, 'scan')}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <Text style={[text.h2, { marginBottom: space.sm }]}>Activity</Text>
            {log.map((a) => (
              <View key={a.id} style={styles.logRow}>
                <View style={[styles.logDot, a.type === 'QR_REFUSED' || a.type === 'PAYMENT_FAILED' ? { backgroundColor: colors.danger } : null]} />
                <View style={styles.flex}>
                  <Text style={text.body}>{a.message}</Text>
                  <Text style={text.caption}>
                    {a.actor.name} · {when(a.at)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  col: { flexGrow: 1, flexBasis: 340, minWidth: 0 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: shape.inner, backgroundColor: app.navySoft, marginTop: space.sm },
  card: { padding: space.lg, marginTop: space.md, borderWidth: 1, borderColor: app.hairline },
  kicker: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.inkMuted, marginBottom: 2 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
  pieces: { fontFamily: fonts.bold, fontSize: 15, color: colors.orange },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  qty: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  qrRow: { paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: app.hairline },
  logRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy, marginTop: 6 },
  error: { ...text.caption, color: colors.danger, marginBottom: space.sm },
});
