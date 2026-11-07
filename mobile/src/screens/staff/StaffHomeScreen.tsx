import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Button, StatusBadge } from '../../components/app/primitives';
import { EmptyState, ListSkeleton } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useCurrentStaff, useLaundryState } from '../../laundry/hooks';
import { STAFF_ROLE_LABEL, TONE } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { ago, money, plural } from '../../lib/format';
import { MODE_COPY, STATUS_COPY } from '../../mock/engine/lifecycle';
import { findCustomer, ordersForLocation } from '../../mock/engine/selectors';
import { mockStore } from '../../mock/store/mockStore';
import type { LaundryOrder } from '../../mock/types';
import type { ScreenProps } from '../../navigation/types';
import { useSession } from '../../session/session';
import { app, colors, fonts, shape, space, text } from '../../theme';
import { StaffFrame, SyncDot } from './StaffFrame';
import { nextAction, runAction, staffHint } from './staffActions';

type Filter = 'accept' | 'pickups' | 'processing' | 'ready' | 'done' | 'all';
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const today = () => new Date().toISOString().slice(0, 10);

const MATCH: Record<Filter, (o: LaundryOrder) => boolean> = {
  accept: (o) => o.status === 'AWAITING_STAFF_ACCEPTANCE',
  pickups: (o) => o.serviceMode === 'HOME_PICKUP' && o.status === 'AWAITING_STAFF_ACCEPTANCE',
  processing: (o) => o.status === 'ACCEPTED' || o.status === 'PICKUP_CONFIRMED' || o.status === 'PROCESSING',
  ready: (o) => o.status === 'READY_FOR_DELIVERY' || o.status === 'AWAITING_CUSTOMER_VERIFICATION',
  done: (o) => o.status === 'DELIVERED' && (o.deliveredAt ?? '').slice(0, 10) === today(),
  all: () => true,
};

/**
 * The staff home: one big Scan button, today's work at this location by stage, each order with its next step, and
 * what happened recently. Only this location's orders are ever listed.
 */
export function StaffHomeScreen({ navigation }: ScreenProps<'StaffHome'>) {
  const state = useLaundryState();
  const me = useCurrentStaff();
  const { signOut } = useSession();
  const [filter, setFilter] = useState<Filter>('accept');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const orders = useMemo(() => (state && me ? ordersForLocation(state, me.location.id) : []), [state, me]);
  const activity = useMemo(
    () =>
      state && me
        ? state.activities
            .filter((a) => a.locationId === me.location.id)
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
            .slice(0, 8)
        : [],
    [state, me],
  );

  if (!state || !me) {
    return (
      <StaffFrame title="Staff" back={false}>
        {state && !me ? (
          <EmptyState icon="user" title="Staff account not found" message="Sign in again with the staff number and your location’s PIN code." action={{ label: 'Sign out', onPress: signOut }} />
        ) : (
          <ListSkeleton rows={4} height={100} />
        )}
      </StaffFrame>
    );
  }
  const { staff, location } = me;
  const shown = orders.filter(MATCH[filter]);
  const tiles: {
    id: Filter;
    label: string;
    icon: 'inbox' | 'truck' | 'droplet' | 'package' | 'check';
    show: boolean;
  }[] = [
    { id: 'accept', label: 'To accept', icon: 'inbox', show: true },
    {
      id: 'pickups',
      label: 'Pickups',
      icon: 'truck',
      show: location.serviceModes.includes('HOME_PICKUP'),
    },
    { id: 'processing', label: 'Processing', icon: 'droplet', show: true },
    { id: 'ready', label: 'Ready', icon: 'package', show: true },
    { id: 'done', label: 'Done today', icon: 'check', show: true },
  ];

  const act = async (o: LaundryOrder) => {
    const a = nextAction(state, o, staff);
    if (!a) return navigation.navigate('StaffOrder', { orderId: o.id });
    if (a.kind === 'scan-intake')
      return navigation.navigate('StaffScan', {
        intent: 'INTAKE',
        orderId: o.id,
      });
    if (a.kind === 'scan-delivery')
      return navigation.navigate('StaffScan', {
        intent: 'DELIVERY',
        orderId: o.id,
      });
    setBusy(o.id);
    setError(null);
    try {
      await runAction(a.kind, o.id, staff.id);
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await mockStore.reset();
      haptic.success();
      setMenuOpen(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <StaffFrame
      title={`Hi, ${staff.name.split(' ')[0]}`}
      subtitle={`${location.name} · ${STAFF_ROLE_LABEL[staff.role]}`}
      back={false}
      right={
        <View style={styles.headRight}>
          <SyncDot />
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Staff menu" hitSlop={6} style={[styles.round, webCursor]}>
            <Icon name="menu" size={20} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <Rise>
        <Pressable
          onPress={() => navigation.navigate('StaffScan', { intent: 'ANY' })}
          accessibilityRole="button"
          accessibilityLabel="Scan a customer QR code"
          style={({ pressed }) => [styles.scan, webCursor, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
        >
          <View style={styles.scanIcon}>
            <Icon name="grid" size={30} color={colors.ink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.scanTitle}>Scan QR</Text>
            <Text style={styles.scanSub}>Accept a drop-off or pickup, or complete a delivery</Text>
          </View>
          <Icon name="arrowRight" size={22} color="#FFFFFF" />
        </Pressable>
      </Rise>

      <View style={styles.tiles} accessibilityRole="tablist">
        {tiles
          .filter((t) => t.show)
          .map((t) => {
            const on = filter === t.id;
            const count = orders.filter(MATCH[t.id]).length;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  haptic.tap();
                  setFilter(t.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.label}: ${count}`}
                style={({ pressed }) => [styles.tile, on && styles.tileOn, webCursor, pressed && { opacity: 0.9 }]}
              >
                <Icon name={t.icon} size={18} color={on ? '#FFFFFF' : colors.navy} />
                <Text style={[styles.tileCount, on && styles.onText]}>{count}</Text>
                <Text style={[styles.tileLabel, on && styles.onSoft]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <View style={styles.listHead}>
        <Text style={text.h2}>{tiles.find((t) => t.id === filter)?.label ?? 'All orders'}</Text>
        <Pressable onPress={() => setFilter(filter === 'all' ? 'accept' : 'all')} accessibilityRole="button" style={webCursor}>
          <Text style={styles.link}>{filter === 'all' ? 'Show to accept' : `All orders (${orders.length})`}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {shown.length ? (
        <View style={styles.list}>
          {shown.map((o) => {
            const a = nextAction(state, o, staff);
            const customer = findCustomer(state, o.customerId);
            const st = STATUS_COPY[o.status];
            const hint = staffHint(state, o);
            return (
              // the card and its action button sit side by side, never one inside the other
              <View key={o.id} style={styles.card}>
                <Pressable
                  onPress={() => navigation.navigate('StaffOrder', { orderId: o.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.id}, ${customer?.name ?? ''}, ${st.label}`}
                  style={({ pressed }) => [webCursor, pressed && { opacity: 0.8 }]}
                >
                  <View style={styles.cardTop}>
                    <GarmentIcon name={o.lines[0]?.icon ?? 'shirt'} size={40} />
                    <View style={styles.flex}>
                      <Text style={styles.cardId}>
                        {o.id} · {MODE_COPY[o.serviceMode].short}
                      </Text>
                      <Text style={text.bodyStrong} numberOfLines={1}>
                        {customer?.name ?? 'Customer'}
                      </Text>
                      <Text style={text.caption}>
                        {plural(o.pieces, 'piece')} · {money(o.total)} · {ago(o.updatedAt)}
                      </Text>
                    </View>
                    <StatusBadge label={st.label} tone={TONE[st.tone]} />
                  </View>
                  {hint ? <Text style={[text.caption, styles.hint]}>{hint}</Text> : null}
                </Pressable>
                {a ? <Button label={a.label} icon={a.icon} variant={a.kind.startsWith('scan') ? 'primary' : 'dark'} onPress={() => act(o)} loading={busy === o.id} style={styles.cardBtn} /> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Icon name="inbox" size={22} color={colors.inkMuted} />
          <Text style={[text.body, { textAlign: 'center' }]}>Nothing here right now.</Text>
        </View>
      )}

      {activity.length ? (
        <>
          <Text style={[text.h2, { marginTop: space.xxl, marginBottom: space.sm }]}>Recent activity</Text>
          <View style={styles.activity}>
            {activity.map((a) => (
              <Pressable key={a.id} onPress={() => navigation.navigate('StaffOrder', { orderId: a.orderId })} accessibilityRole="button" style={[styles.actRow, webCursor]}>
                <View style={styles.actDot} />
                <View style={styles.flex}>
                  <Text style={text.bodyStrong} numberOfLines={1}>
                    {a.orderId} · {a.message}
                  </Text>
                  <Text style={text.caption}>
                    {a.actor.name} · {ago(a.at)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={text.h1}>{staff.name}</Text>
        <Text style={[text.body, { marginTop: 2 }]}>
          {STAFF_ROLE_LABEL[staff.role]} · {location.name}
        </Text>
        <View style={styles.menuInfo}>
          <Icon name="info" size={15} color={colors.inkSoft} />
          <Text style={[text.caption, styles.flex]}>Demo staff access: signed in with the demo staff number and this location’s PIN code. Mock data only, not real security.</Text>
        </View>
        <Button label="Reset demo data" icon="refresh" variant="outline" onPress={reset} loading={resetting} style={{ marginTop: space.lg }} />
        <Text style={[text.caption, { marginTop: space.xs, textAlign: 'center' }]}>Puts every order, wallet and QR back to the starting demo data, on every connected device.</Text>
        <Button label="Sign out" icon="logout" variant="dark" onPress={signOut} style={{ marginTop: space.lg }} />
      </BottomSheet>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: app.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.xl,
    borderRadius: 26,
    backgroundColor: app.navyDeep,
    marginTop: space.sm,
  },
  scanIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  scanSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 100,
    padding: space.md,
    borderRadius: shape.tile,
    backgroundColor: app.cream,
    gap: 2,
  },
  tileOn: { backgroundColor: colors.ink },
  tileCount: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.ink,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  onText: { color: '#FFFFFF' },
  onSoft: { color: 'rgba(255,255,255,0.75)' },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xxl,
    marginBottom: space.md,
  },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.navy },
  error: { ...text.caption, color: colors.danger, marginBottom: space.sm },
  list: { gap: space.md },
  card: {
    padding: space.lg,
    borderRadius: shape.tile,
    backgroundColor: app.card,
    borderWidth: 1,
    borderColor: app.hairline,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardId: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  hint: { marginTop: space.sm },
  cardBtn: { marginTop: space.md },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xxl,
    borderRadius: shape.tile,
    backgroundColor: app.cream,
  },
  activity: {
    borderRadius: shape.tile,
    backgroundColor: app.card,
    borderWidth: 1,
    borderColor: app.hairline,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  actDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  menuInfo: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: shape.inner,
    backgroundColor: app.cream,
  },
});
