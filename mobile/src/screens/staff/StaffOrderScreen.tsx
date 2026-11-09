import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Avatar } from '../../components/app/primitives';
import { EmptyState } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { LineGarments } from '../../components/laundry/LineGarments';
import { lineQtyLabel, piecesToCount } from '../../mock/engine/garments';
import { OrderTimeline } from '../../components/laundry/OrderTimeline';
import { QtyStepper } from '../../components/laundry/QtyStepper';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillTextArea } from '../../components/ui/SheetForm';
import { STAFF_ROLE_LABEL } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { date, money, plural, when } from '../../lib/format';
import { isTerminal, MODE_COPY, PAYMENT_COPY, QR_PURPOSE_COPY } from '../../mock/engine/lifecycle';
import { activitiesFor, findCustomer, findReceipt, findStaff, openIssueFor, qrState } from '../../mock/engine/selectors';
import * as staffService from '../../mock/services/staffService';
import type { IssueKind } from '../../mock/types';
import type { ScreenProps } from '../../navigation/types';
import { can, canSeeContact, displayName, isSupervisor, maskPhone, nextAction, TURNAROUND_HOURS, waitingOn } from '../../staff/work';
import { colors, fonts, space } from '../../theme';
import { BEIGE, Button, CHIP, Line, Notice, Panel, RULE, shared, StaffPage, StageTrack, StatusChip, Tag, useOrderAction, useStaff, webCursor } from './kit';

const ISSUE_KINDS: { id: IssueKind; label: string }[] = [
  { id: 'DAMAGED', label: 'Damaged item' },
  { id: 'MISSING_ITEMS', label: 'Missing item' },
  { id: 'WRONG_ITEMS', label: 'Wrong item' },
  { id: 'OTHER', label: 'Something else' },
];

const REJECT_REASONS = [
  'Item counts don’t match the order',
  'Items need a service we don’t offer here',
  'Damaged items the customer didn’t mention',
  'Customer asked to cancel',
];

/**
 * One order, for staff at its branch: where it stands and the next step, who it's for, what's in it, how it was
 * paid and verified, and every step anyone took. Supervisors can assign it; anyone working on it can flag a problem.
 */
const isPast = (iso: string) => Date.parse(iso) < Date.now();

export function StaffOrderScreen({ navigation, route }: ScreenProps<'StaffOrder'>) {
  const { orderId } = route.params;
  const { state, me } = useStaff();
  const action = useOrderAction(me?.staff.id);
  const [assignOpen, setAssignOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);

  const order = state?.orders.find((o) => o.id === orderId);
  if (!state || !me) return <StaffPage title={orderId} tab={false}>{null}</StaffPage>;
  if (!order || order.locationId !== me.location.id) {
    return (
      <StaffPage title={orderId} tab={false}>
        <EmptyState icon="alert" title="Not your branch’s order" message="You can only see orders for your own branch." action={{ label: 'Back to home', onPress: () => navigation.navigate('StaffTabs', { screen: 'StaffHome' }) }} />
      </StaffPage>
    );
  }

  const st = me.staff;
  const customer = findCustomer(state, order.customerId);
  const full = canSeeContact(st, order);
  const next = nextAction(state, order, st);
  const issue = openIssueFor(state, order.id);
  const receipt = findReceipt(state, order.id);
  const qrs = state.qrTokens.filter((q) => q.orderId === order.id);
  const log = activitiesFor(state, order.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const assignee = order.assignedTo ? findStaff(state, order.assignedTo) : undefined;
  const canFlag = can(st, 'ISSUE_REPORT') && !issue && ['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING', 'READY_FOR_DELIVERY'].includes(order.status) && (!order.assignedTo || order.assignedTo === st.id || isSupervisor(st));
  const canAssign = isSupervisor(st) && !isTerminal(order.status) && order.status !== 'PAYMENT_PENDING';
  const due = order.acceptedAt && ['ACCEPTED', 'PICKUP_CONFIRMED', 'PROCESSING'].includes(order.status) ? new Date(Date.parse(order.acceptedAt) + TURNAROUND_HOURS * 3600_000).toISOString() : undefined;
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});

  const isAwaitingAcceptance = order.status === 'AWAITING_STAFF_ACCEPTANCE' && can(st, 'ORDER_ACCEPT');

  const handleDirectAccept = async () => {
    if (!order || acting) return;
    setActing('accept');
    setDirectError(null);
    try {
      const qrId = order.intakeQrId || qrs[0]?.id || `qr-${order.id.toLowerCase()}`;
      await staffService.acceptOrder(order.id, st.id, qrId);
      haptic.success();
    } catch (e) {
      haptic.error();
      setDirectError(e instanceof Error ? e.message : 'Couldn’t accept this order. Try again.');
    } finally {
      setActing(null);
    }
  };

  const handleDirectReject = async () => {
    if (!order || acting) return;
    setActing('reject');
    setDirectError(null);
    try {
      const qrId = order.intakeQrId || qrs[0]?.id || `qr-${order.id.toLowerCase()}`;
      await staffService.rejectOrder(order.id, st.id, qrId, rejectReason.trim() || 'Items do not match the order');
      haptic.success();
      setRejectOpen(false);
    } catch (e) {
      haptic.error();
      setDirectError(e instanceof Error ? e.message : 'Couldn’t reject this order. Try again.');
    } finally {
      setActing(null);
    }
  };

  const footer =
    isAwaitingAcceptance ? (
      <>
        {directError ? (
          <Text style={shared.error} accessibilityRole="alert">
            {directError}
          </Text>
        ) : null}
        <View style={styles.footRow}>
          <Button
            label="Reject"
            icon="x"
            variant="outline"
            onPress={() => setRejectOpen(true)}
            disabled={!!acting}
            style={[styles.flex, { height: 46, borderRadius: 23 }]}
          />
          <Button
            label={order.serviceMode === 'HOME_PICKUP' ? 'Accept & collect' : 'Accept order'}
            icon="check"
            variant="dark"
            onPress={handleDirectAccept}
            loading={acting === 'accept'}
            disabled={!!acting}
            style={[styles.grow, { height: 46, borderRadius: 23 }]}
          />
        </View>
      </>
    ) : next || canFlag || canAssign ? (
      <>
        {action.error ? (
          <Text style={shared.error} accessibilityRole="alert">
            {action.error.message}
          </Text>
        ) : null}
        {next ? (
          <Button
            label={next.label}
            icon={next.icon}
            variant="dark"
            style={{ height: 46, borderRadius: 23 }}
            onPress={() => action.run(order, next)}
            loading={action.busy === order.id}
          />
        ) : null}
        {canFlag || canAssign ? (
          <View style={styles.footRow}>
            {canAssign ? <Button label={assignee ? 'Reassign' : 'Assign'} icon="users" variant="outline" onPress={() => setAssignOpen(true)} style={[styles.flex, { height: 46, borderRadius: 23 }]} /> : null}
            {canFlag ? <Button label="Flag issue" icon="alert" variant="outline" onPress={() => setIssueOpen(true)} style={[styles.flex, { height: 46, borderRadius: 23 }]} /> : null}
          </View>
        ) : null}
      </>
    ) : undefined;

  return (
    <StaffPage title={order.id} subtitle={`${MODE_COPY[order.serviceMode].label} · ${me.location.shortName}`} tab={false} footer={footer}>
      {/* where it stands */}
      <Rise distance={10}>
        <Panel>
          <View style={styles.headRow}>
            <StatusChip order={order} />
            {assignee ? <Tag label={assignee.id === st.id ? 'Assigned to you' : `Assigned · ${assignee.name.split(' ')[0]}`} tone="navy" icon="user" /> : null}
          </View>
          <Text style={[shared.h1, { marginTop: space.md }]}>{waitingOn(state, order, st)}</Text>
          {due ? <Text style={[shared.caption, { marginTop: 4 }, isPast(due) && { color: colors.danger }]}>{isPast(due) ? `Past the ${TURNAROUND_HOURS}h turnaround · was due ${when(due)}` : `Due ${when(due)}`}</Text> : null}
          {['PROCESSING', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION', 'DELIVERED'].includes(order.status) ? (
            <View style={{ marginTop: space.lg }}>
              <StageTrack order={order} />
            </View>
          ) : null}
        </Panel>
      </Rise>

      {issue ? (
        <Notice tone="danger" title={issue.source === 'staff' ? `Flagged by ${findStaff(state, issue.reportedBy ?? '')?.name ?? 'staff'}` : 'Customer reported an issue'}>
          <Text style={shared.body}>{issue.mismatches.length ? issue.mismatches.map((m) => `${m.name}: ${m.received} of ${m.expected}`).join(' · ') : issue.note}</Text>
          {issue.mismatches.length && issue.note ? <Text style={[shared.caption, { marginTop: 2 }]}>“{issue.note}”</Text> : null}
          <Text style={[shared.caption, { marginTop: space.xs }]}>Reported {when(issue.reportedAt)}. Handover waits until the admin team resolves it.</Text>
        </Notice>
      ) : null}

      {/* who */}
      <Panel>
        <Text style={shared.kicker}>Customer</Text>
        <View style={styles.who}>
          <Avatar name={customer?.name ?? 'Customer'} size={44} />
          <View style={styles.flex}>
            <Text style={shared.h2}>{displayName(customer?.name ?? 'Customer', full)}</Text>
            <Text style={shared.caption}>{full ? customer?.phone : customer ? maskPhone(customer.phone) : ''}</Text>
          </View>
          {full && customer && (customer.phone || order.pickup?.contactPhone) ? (
            <Pressable onPress={() => call(order.pickup?.contactPhone ?? customer.phone)} accessibilityRole="button" accessibilityLabel={`Call ${customer.name}`} hitSlop={6} style={({ pressed }) => [styles.call, webCursor, pressed && { transform: [{ scale: 0.94 }] }]}>
              <Icon name="phone" size={17} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        {order.pickup && full ? (
          <View style={styles.address}>
            <Icon name="mapPin" size={16} color={colors.navy} />
            <View style={styles.flex}>
              <Text style={shared.strong}>
                {date(`${order.pickup.date}T00:00:00`)} · {order.pickup.slotLabel}
              </Text>
              <Text style={shared.caption}>
                {order.pickup.address}
                {order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''}
              </Text>
              {Platform.OS !== 'web' ? (
                <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.pickup!.address)}`).catch(() => {})} accessibilityRole="link" style={webCursor}>
                  <Text style={styles.link}>Open in maps</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {!full ? <Text style={[shared.caption, { marginTop: space.sm }]}>Contact details are shown to counter, delivery and supervisor roles.</Text> : null}
      </Panel>

      {/* what */}
      <Panel>
        <View style={styles.headRow}>
          <Text style={shared.h2}>Items</Text>
          <Text style={styles.pieces}>{plural(piecesToCount(order.lines) || order.pieces, 'piece')}</Text>
        </View>
        {order.lines.map((l) => (
          <React.Fragment key={l.itemId}>
            <View style={styles.item}>
              <View style={styles.itemArt}>
                <GarmentIcon name={l.icon} size={30} />
              </View>
              <View style={styles.flex}>
                <Text style={shared.strong}>{l.name}</Text>
                <Text style={shared.caption}>
                  {l.categoryName} · {money(l.unitPrice)} / {l.unit}
                </Text>
              </View>
              <Text style={styles.qty}>{lineQtyLabel(l)}</Text>
            </View>
            <LineGarments line={l} />
          </React.Fragment>
        ))}
        <View style={shared.rule} />
        <Line label="Items" value={money(order.subtotal)} />
        <Line label={order.serviceMode === 'HOME_PICKUP' ? 'Pickup & delivery' : 'Service charge'} value={order.serviceCharge ? money(order.serviceCharge) : 'Free'} />
        {order.discount ? <Line label={`Discount${order.couponCode ? ` · ${order.couponCode}` : ''}`} value={`− ${money(order.discount)}`} color="#0D7A21" /> : null}
        <Line label="Total" value={money(order.total)} strong />
        {order.instructions ? (
          <View style={styles.note}>
            <Icon name="info" size={14} color={colors.inkSoft} />
            <Text style={[shared.caption, styles.flex]}>Customer note: {order.instructions}</Text>
          </View>
        ) : null}
      </Panel>

      {/* service, payment and verification */}
      <Panel>
        <Text style={[shared.h2, { marginBottom: space.xs }]}>Service & payment</Text>
        <Line label="Service" value={MODE_COPY[order.serviceMode].label} />
        <Line label="Branch" value={me.location.shortName} />
        <Line label="Placed" value={when(order.createdAt)} />
        <Line label="Payment" value={PAYMENT_COPY[order.payment.status].label} color={order.payment.status === 'COMPLETED' ? '#0D7A21' : order.payment.status === 'FAILED' ? colors.danger : undefined} />
        {order.payment.paidAt ? <Line label="Paid" value={`${when(order.payment.paidAt)} · wallet`} /> : null}
        {order.payment.txnId ? <Line label="Transaction" value={order.payment.txnId} /> : null}
        {receipt ? <Line label="Receipt" value={receipt.number} /> : null}
        {order.verification ? <Line label="Customer checked" value={`${order.verification.piecesConfirmed} pieces · ${when(order.verification.confirmedAt)}`} /> : null}
        <View style={shared.rule} />
        <Text style={[shared.kicker, { marginBottom: space.xs }]}>QR verification</Text>
        {qrs.map((q) => {
          const s = qrState(q, new Date().toISOString());
          const tone = s === 'ACTIVE' ? 'ok' : s === 'CONSUMED' ? 'chip' : s === 'LOCKED' ? 'warn' : 'danger';
          return (
            <View key={q.id} style={styles.qr}>
              <View style={styles.flex}>
                <Text style={shared.strong}>{QR_PURPOSE_COPY[q.purpose].label}</Text>
                <Text style={shared.caption}>
                  {q.consumedAt ? `Used ${when(q.consumedAt)}${q.consumedBy ? ` by ${findStaff(state, q.consumedBy)?.name ?? q.consumedBy}` : ''}` : q.revokeReason ?? (q.expiresAt ? `Valid until ${when(q.expiresAt)}` : 'Unlocks after payment')}
                  {q.scans.length ? ` · ${plural(q.scans.length, 'scan')}` : ''}
                </Text>
              </View>
              <Tag label={s === 'CONSUMED' ? 'Used' : s[0] + s.slice(1).toLowerCase()} tone={tone} />
            </View>
          );
        })}
      </Panel>

      {/* the journey, as the customer sees it */}
      <Panel>
        <Text style={[shared.h2, { marginBottom: space.md }]}>Order timeline</Text>
        <OrderTimeline order={order} state={state} />
      </Panel>

      {/* everything staff and the system did */}
      <Panel>
        <Text style={[shared.h2, { marginBottom: space.xs }]}>Staff activity</Text>
        {log.map((a, i) => (
          <View key={a.id} style={[styles.log, i > 0 && styles.logRule]}>
            <View style={[styles.logDot, a.type === 'QR_REFUSED' || a.type === 'PAYMENT_FAILED' || a.type === 'ISSUE_REPORTED' ? { backgroundColor: colors.danger } : a.actor.kind === 'staff' ? { backgroundColor: colors.orange } : null]} />
            <View style={styles.flex}>
              <Text style={shared.body}>{a.message}</Text>
              <Text style={shared.caption}>
                {a.actor.kind === 'staff' ? a.actor.name : a.actor.kind === 'customer' ? 'Customer' : a.actor.kind === 'admin' ? 'Admin' : 'System'} · {when(a.at)}
              </Text>
            </View>
          </View>
        ))}
      </Panel>

      <BottomSheet visible={assignOpen} onClose={() => setAssignOpen(false)}>
        {assignOpen ? <AssignSheet orderId={order.id} current={order.assignedTo} onDone={() => setAssignOpen(false)} /> : null}
      </BottomSheet>
      <BottomSheet visible={issueOpen} onClose={() => setIssueOpen(false)}>
        {issueOpen ? <IssueSheet orderId={order.id} onDone={() => setIssueOpen(false)} /> : null}
      </BottomSheet>
      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        {rejectOpen ? (
          <View>
            <Text style={shared.h1}>Reject {order.id}?</Text>
            <Text style={[shared.body, { marginTop: space.xs }]}>
              {money(order.payment.amount)} goes straight back to the customer’s wallet, and they’ll see your reason.
            </Text>
            <View style={styles.reasons} accessibilityRole="radiogroup">
              {REJECT_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRejectReason(r)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: rejectReason === r }}
                  style={[styles.reason, rejectReason === r && styles.reasonOn, webCursor]}
                >
                  <Text style={[styles.reasonText, rejectReason === r && { color: '#FFFFFF' }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <PillTextArea
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Or write the reason"
              accessibilityLabel="Reason for rejecting"
            />
            {directError ? <Text style={[shared.error, { marginTop: space.sm }]}>{directError}</Text> : null}
            <Button
              label="Reject & refund"
              variant="dark"
              onPress={handleDirectReject}
              loading={acting === 'reject'}
              disabled={rejectReason.trim().length < 3 || !!acting}
              style={{ marginTop: space.lg }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </StaffPage>
  );
}

/** Supervisor: give the order to someone at the branch, or back to everyone. */
function AssignSheet({ orderId, current, onDone }: { orderId: string; current?: string; onDone: () => void }) {
  const { state, me } = useStaff();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!state || !me) return null;
  const team = state.staff.filter((x) => x.locationId === me.location.id && x.status === 'ACTIVE' && x.id !== me.staff.id);
  const open = state.orders.filter((o) => o.locationId === me.location.id && !isTerminal(o.status));
  const pick = async (staffId: string | null) => {
    setBusy(staffId ?? 'none');
    setError(null);
    try {
      await staffService.assignOrder(orderId, me.staff.id, staffId);
      haptic.success();
      onDone();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t assign.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View>
      <Text style={shared.h1}>Assign {orderId}</Text>
      <Text style={[shared.body, { marginTop: 4 }]}>Only the person you choose (and supervisors) can move it on.</Text>
      <View style={{ marginTop: space.lg }}>
        {team.map((x, i) => {
          const load = open.filter((o) => o.assignedTo === x.id).length;
          const on = current === x.id;
          return (
            <Pressable key={x.id} onPress={() => !on && pick(x.id)} disabled={!!busy} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.pick, i > 0 && styles.logRule, webCursor, pressed && { opacity: 0.7 }]}>
              <Avatar name={x.name} size={38} />
              <View style={styles.flex}>
                <Text style={shared.strong}>{x.name}</Text>
                <Text style={shared.caption}>
                  {STAFF_ROLE_LABEL[x.role]} · {plural(load, 'assigned order')}
                </Text>
              </View>
              {busy === x.id ? <Text style={shared.caption}>Saving…</Text> : on ? <Tag label="Assigned" tone="navy" icon="check" /> : <Icon name="chevronRight" size={16} color={colors.inkMuted} />}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[shared.error, { marginTop: space.sm }]}>{error}</Text> : null}
      {current ? <Button label="Clear assignment" variant="outline" onPress={() => pick(null)} loading={busy === 'none'} style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}

/** Flag damaged, missing or wrong items. Item counts are optional; a short note is required. */
function IssueSheet({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { state, me } = useStaff();
  const order = state?.orders.find((o) => o.id === orderId);
  const [kind, setKind] = useState<IssueKind>('DAMAGED');
  const [note, setNote] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries((order?.lines ?? []).map((l) => [l.itemId, l.qty])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!order || !me) return null;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await staffService.reportIssue(order.id, me.staff.id, kind, note, kind === 'MISSING_ITEMS' || kind === 'WRONG_ITEMS' ? counts : undefined);
      haptic.success();
      onDone();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t flag the issue.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Text style={shared.h1}>Flag an issue</Text>
      <Text style={[shared.body, { marginTop: 4 }]}>The admin team is told straight away. Processing can go on, but handover waits until they resolve it.</Text>
      <View style={styles.kinds}>
        {ISSUE_KINDS.map((k) => (
          <Pressable key={k.id} onPress={() => setKind(k.id)} accessibilityRole="radio" accessibilityState={{ selected: kind === k.id }} style={[styles.kind, kind === k.id && styles.kindOn, webCursor]}>
            <Text style={[styles.kindText, kind === k.id && { color: '#FFFFFF' }]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      {kind === 'MISSING_ITEMS' || kind === 'WRONG_ITEMS' ? (
        <View style={{ marginBottom: space.md }}>
          <Text style={[shared.kicker, { marginBottom: space.xs }]}>Pieces actually here</Text>
          {order.lines.map((l) => (
            <View key={l.itemId} style={styles.countRow}>
              <View style={styles.flex}>
                <Text style={shared.strong}>{l.name}</Text>
                <Text style={shared.caption}>Order says {l.qty}</Text>
              </View>
              <QtyStepper value={counts[l.itemId] ?? 0} onChange={(n) => setCounts((c) => ({ ...c, [l.itemId]: n }))} max={l.qty + 5} label={l.name} compact />
            </View>
          ))}
        </View>
      ) : null}
      <PillTextArea value={note} onChangeText={setNote} placeholder="What’s wrong? e.g. collar torn on the blue shirt" accessibilityLabel="Describe the issue" />
      {error ? <Text style={[shared.error, { marginTop: space.sm }]}>{error}</Text> : null}
      <Button label="Flag issue" variant="dark" icon="alert" onPress={send} loading={busy} disabled={note.trim().length < 5} style={{ marginTop: space.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flex: 1.6 },
  footRow: { flexDirection: 'row', gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  call: { width: 40, height: 40, borderRadius: 20, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  address: { flexDirection: 'row', gap: space.sm, marginTop: space.md, padding: space.md, borderRadius: 16, backgroundColor: '#EBF6FE' },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy, marginTop: 4 },
  pieces: { fontFamily: fonts.bold, fontSize: 15, color: colors.logoOrange },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  itemArt: { width: 42, height: 42, borderRadius: 14, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', gap: 6, marginTop: space.md, padding: space.md, borderRadius: 14, backgroundColor: CHIP },
  qr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  log: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  logRule: { borderTopWidth: 1, borderTopColor: RULE },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy, marginTop: 7 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginVertical: space.lg },
  kind: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: CHIP, justifyContent: 'center' },
  kindOn: { backgroundColor: colors.ink },
  kindText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  reasons: { gap: space.xs, marginVertical: space.lg },
  reason: { padding: space.md, borderRadius: 16, backgroundColor: CHIP },
  reasonOn: { backgroundColor: colors.ink },
  reasonText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
});
