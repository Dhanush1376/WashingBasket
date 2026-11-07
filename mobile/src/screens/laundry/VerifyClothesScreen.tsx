import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/app/AppScreen';
import { Icon } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Button, Card } from '../../components/app/primitives';
import { EmptyState, ListSkeleton } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { QtyStepper } from '../../components/laundry/QtyStepper';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { OptionChip, PillTextArea } from '../../components/ui/SheetForm';
import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { haptic } from '../../lib/haptics';
import { plural } from '../../lib/format';
import { openIssueFor } from '../../mock/engine/selectors';
import { confirmClothes, reportIssue } from '../../mock/services/orderService';
import type { IssueKind } from '../../mock/types';
import type { ScreenProps } from '../../navigation/types';
import { app, colors, fonts, shape, space, text } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

const ISSUE_KINDS: { kind: IssueKind; label: string; icon: 'minus' | 'alert' | 'refresh' | 'info' }[] = [
  { kind: 'MISSING_ITEMS', label: 'Pieces missing', icon: 'minus' },
  { kind: 'DAMAGED', label: 'Something damaged', icon: 'alert' },
  { kind: 'WRONG_ITEMS', label: 'Not my clothes', icon: 'refresh' },
  { kind: 'OTHER', label: 'Something else', icon: 'info' },
];

/**
 * Before delivery is completed the customer counts their clothes against the order. When every count matches they
 * confirm and get the delivery QR; when something is off they report it instead, and delivery waits.
 */
export function VerifyClothesScreen({ navigation, route }: ScreenProps<'VerifyClothes'>) {
  const { orderId } = route.params;
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const order = state?.orders.find((o) => o.id === orderId && o.customerId === customer?.id);

  const [received, setReceived] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [kind, setKind] = useState<IssueKind>('MISSING_ITEMS');
  const [note, setNote] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);

  // start every count at what was ordered; the customer changes only what's different
  const [countsFor, setCountsFor] = useState<string | null>(null);
  if (order && countsFor !== order.id) {
    setCountsFor(order.id);
    setReceived(Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])));
  }

  if (!state || !customer) {
    return (
      <AppScreen title="Check your clothes">
        <ListSkeleton rows={3} height={90} />
      </AppScreen>
    );
  }
  if (!order) {
    return (
      <AppScreen title="Check your clothes">
        <EmptyState icon="bag" title="Order not found" message="This order isn’t on your account." />
      </AppScreen>
    );
  }

  const issue = openIssueFor(state, order.id);
  const checkable = order.status === 'READY_FOR_DELIVERY' || order.status === 'AWAITING_CUSTOMER_VERIFICATION';
  const alreadyConfirmed = order.status === 'AWAITING_CUSTOMER_VERIFICATION' && !!order.verification;
  if (!checkable || alreadyConfirmed || issue) {
    return (
      <AppScreen title="Check your clothes">
        <EmptyState
          icon={issue ? 'alert' : 'check'}
          title={issue ? 'Issue reported' : alreadyConfirmed ? 'Already confirmed' : 'Not ready yet'}
          message={issue ? 'Our team is looking into your report. We’ll let you know here.' : alreadyConfirmed ? 'Your delivery QR is on the order page.' : 'You can check your clothes once the order is ready.'}
          action={{ label: 'Back to order', onPress: () => navigation.popTo('LaundryOrder', { orderId }) }}
        />
      </AppScreen>
    );
  }

  const mismatches = order.lines.filter((l) => (received[l.itemId] ?? l.qty) !== l.qty);
  const total = order.lines.reduce((n, l) => n + (received[l.itemId] ?? l.qty), 0);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmClothes(order.id, customer.id, received);
      haptic.success();
      navigation.popTo('LaundryOrder', { orderId: order.id });
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t confirm. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const openReport = () => {
    setKind(mismatches.length ? 'MISSING_ITEMS' : 'DAMAGED');
    setReportError(null);
    setReportOpen(true);
  };

  const submitReport = async () => {
    setBusy(true);
    setReportError(null);
    try {
      await reportIssue({ orderId: order.id, customerId: customer.id, kind, received, note });
      haptic.success();
      setReportOpen(false);
      navigation.popTo('LaundryOrder', { orderId: order.id });
    } catch (e) {
      haptic.error();
      setReportError(e instanceof Error ? e.message : 'Couldn’t send your report.');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {mismatches.length ? (
        <Button label="Report an issue" icon="alert" variant="dark" onPress={openReport} />
      ) : (
        <Button label="Confirm all pieces received" icon="check" onPress={confirm} loading={busy} disabled={!checked} />
      )}
      {!mismatches.length ? (
        <Pressable onPress={openReport} accessibilityRole="button" accessibilityLabel="Report an issue" style={[styles.reportLink, webCursor]}>
          <Text style={styles.link}>Something wrong? Report an issue</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <AppScreen title="Check your clothes" footer={footer}>
      <View style={styles.page}>
        <Rise>
          <Card style={styles.notice}>
            <View style={styles.noticeIcon}>
              <Icon name="shirt" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.noticeText}>Please check your clothes and verify that the number of pieces matches your original order before confirming delivery.</Text>
          </Card>
        </Rise>

        <Rise delay={50}>
          <View style={styles.head}>
            <Text style={text.h2}>Order {order.id}</Text>
            <Text style={[text.bodyStrong, mismatches.length > 0 && { color: colors.danger }]}>
              {total} of {plural(order.pieces, 'piece')}
            </Text>
          </View>
          <Card style={styles.list}>
            {order.lines.map((l, i) => {
              const got = received[l.itemId] ?? l.qty;
              const off = got !== l.qty;
              return (
                <View key={l.itemId} style={[styles.row, i > 0 && styles.divider]}>
                  <GarmentIcon name={l.icon} size={42} />
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>{l.name}</Text>
                    <Text style={[text.caption, off && { color: colors.danger, fontFamily: fonts.medium }]}>
                      Ordered {l.qty}
                      {off ? ` · received ${got}` : ''}
                    </Text>
                  </View>
                  <QtyStepper value={got} max={l.qty + 5} label={`${l.name} received`} onChange={(n) => setReceived((r) => ({ ...r, [l.itemId]: n }))} compact />
                </View>
              );
            })}
          </Card>
          <Text style={[text.caption, styles.hint]}>The counts start at what you ordered. Change any that are different.</Text>
        </Rise>

        {!mismatches.length ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              setChecked((c) => !c);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={order.pieces === 1 ? 'I have checked the piece and it matches my order' : `I have checked all ${order.pieces} pieces and they match my order`}
            style={[styles.check, checked && styles.checkOn, webCursor]}
          >
            <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.8} /> : null}</View>
            <Text style={[text.bodyStrong, styles.flex]}>{order.pieces === 1 ? 'I’ve checked the piece and it matches my order.' : `I’ve checked all ${order.pieces} pieces and they match my order.`}</Text>
          </Pressable>
        ) : (
          <View style={styles.mismatch} accessibilityRole="alert">
            <Icon name="alert" size={16} color={colors.danger} />
            <Text style={[text.bodyStrong, styles.flex]}>The counts don’t match your order. Report an issue and we’ll sort it out before delivery is completed.</Text>
          </View>
        )}
      </View>

      <BottomSheet visible={reportOpen} onClose={() => setReportOpen(false)}>
        <Text style={text.h1}>Report an issue</Text>
        <Text style={[text.body, { marginTop: space.xs }]}>Delivery stays open until our team sorts it out.</Text>
        <View style={styles.kinds}>
          {ISSUE_KINDS.map((k, i) => (
            <OptionChip key={k.kind} label={k.label} icon={k.icon} selected={kind === k.kind} delay={i * 30} onPress={() => setKind(k.kind)} style={styles.kind} />
          ))}
        </View>
        {mismatches.length ? (
          <Text style={[text.caption, { marginTop: space.md }]}>Counts that differ: {mismatches.map((m) => `${m.name} ${received[m.itemId]}/${m.qty}`).join(', ')}</Text>
        ) : null}
        <View style={{ marginTop: space.md }}>
          <PillTextArea value={note} onChangeText={setNote} placeholder="What’s wrong? e.g. one white shirt missing" accessibilityLabel="Describe the issue" />
        </View>
        {reportError ? (
          <Text style={[styles.error, { marginTop: space.sm }]} accessibilityRole="alert">
            {reportError}
          </Text>
        ) : null}
        <Button label="Send report" onPress={submitReport} loading={busy} style={{ marginTop: space.lg }} />
      </BottomSheet>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.md, paddingTop: space.sm },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: app.navyDeep },
  noticeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  noticeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm, marginTop: space.sm },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs, borderWidth: 1, borderColor: app.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: app.hairline },
  hint: { marginTop: space.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: shape.tile, backgroundColor: app.cream, borderWidth: 1.5, borderColor: app.cream },
  checkOn: { backgroundColor: colors.successTint, borderColor: '#0D7A21' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.75, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  boxOn: { backgroundColor: '#0D7A21', borderColor: '#0D7A21' },
  mismatch: { flexDirection: 'row', gap: space.sm, padding: space.lg, borderRadius: shape.tile, backgroundColor: colors.dangerTint },
  footer: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  reportLink: { alignSelf: 'center', padding: space.sm, marginTop: space.xs },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  error: { ...text.caption, color: colors.danger, marginBottom: space.sm },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  kind: { flexBasis: '47%', flexGrow: 1 },
});
