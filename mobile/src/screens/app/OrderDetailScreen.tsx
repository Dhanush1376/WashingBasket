import React, { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/app/AppScreen';
import { ART, ART_TINT, STAGE_ART } from '../../components/app/art';
import { Icon } from '../../components/app/Icon';
import { formatCardDate, getOrderTheme, getStatusDot, StageTimeline } from '../../components/app/orders';
import { Button, Card, Divider, KeyValue, StatusBadge } from '../../components/app/primitives';
import { ORDER_STATUS } from '../../components/app/status';
import { EmptyState, ErrorState, Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { haptic } from '../../lib/haptics';
import { date, dayDate, money } from '../../lib/format';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { getAddresses } from '../../services/mock/account.service';
import { slotById } from '../../services/mock/booking.service';
import { getOrder } from '../../services/mock/orders.service';
import { computeTotals, serviceById } from '../../services/mock/pricing.service';
import { cancelRequest } from '../../services/mock/requests.service';
import { app, colors, fonts, shape, space, text } from '../../theme';

export function OrderDetailScreen({ navigation, route }: ScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const order = useQuery(keys.order(orderId), () => getOrder(orderId));
  const addresses = useQuery(keys.addresses, getAddresses);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const o = order.data;
  if (order.loading) {
    return (
      <AppScreen title={`Order #${orderId}`}>
        <View style={{ gap: space.md }}>
          <Skeleton height={180} radius={26} />
          <Skeleton height={320} radius={26} />
        </View>
      </AppScreen>
    );
  }
  if (order.error || !o) {
    return (
      <AppScreen title={`Order #${orderId}`}>
        {order.error ? <ErrorState onRetry={order.refetch} /> : <EmptyState icon="bag" title="Order not found" message="This order may have been removed." />}
      </AppScreen>
    );
  }

  const service = serviceById(o.serviceId);
  const totals = computeTotals(o.items, o.discount);
  const status = ORDER_STATUS[o.status];
  const theme = getOrderTheme(o.status);
  const dotColor = getStatusDot(o.status);
  const address = addresses.data?.find((a) => a.id === o.pickup.addressId);
  const slot = slotById(o.pickup.slotId);
  const art = o.status === 'cancelled' ? service.art : STAGE_ART[o.status];
  const cancellable = o.status === 'pickup_scheduled' && !!o.requestId;

  const cancel = async () => {
    if (!o.requestId) return;
    setCancelling(true);
    await cancelRequest(o.requestId);
    invalidate(keys.order(o.id), keys.orders, keys.requests, keys.dashboard);
    haptic.success();
    setCancelling(false);
    setConfirmCancel(false);
  };

  return (
    <AppScreen title={`Order #${o.id}`} subtitle={`Placed ${date(o.placedAt)}`}>
      {/* Modern Hero Card with dynamic brand shade */}
      <View style={[styles.heroCard, { backgroundColor: theme.bg }]}>
        <View style={styles.heroTop}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusPillText, { color: theme.text }]}>{status.label}</Text>
          </View>
          <Text style={[styles.heroAmount, { color: theme.text }]}>{money(totals.total)}</Text>
        </View>

        <View style={styles.heroBody}>
          <View style={[styles.heroArt, { backgroundColor: 'rgba(255, 255, 255, 0.65)' }]}>
            <Image source={ART[art]} style={styles.fill} resizeMode="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroService, { color: theme.text }]}>{service.name}</Text>
            <Text style={[styles.heroMeta, { color: theme.sub }]}>
              {o.status === 'delivered' && o.deliveredAt
                ? `Delivered ${dayDate(o.deliveredAt)}`
                : o.status === 'cancelled'
                  ? o.cancelReason ?? 'Cancelled'
                  : `Estimated delivery ${dayDate(o.estimatedDelivery)}`}
            </Text>
          </View>
        </View>
      </View>

      {o.status === 'delivered' ? (
        <View style={styles.deliveredCard}>
          <View style={styles.deliveredIcon}>
            <Icon name="truck" size={20} color="#0D7A21" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveredTitle}>Order delivered & confirmed</Text>
            <Text style={styles.deliveredSub}>
              All {totals.garments ? `${totals.garments} pieces` : 'garments'} handed over in clean, fresh condition.
            </Text>
          </View>
        </View>
      ) : null}

      {o.status !== 'cancelled' ? (
        <Card style={styles.block}>
          <Text style={[text.h2, styles.blockTitle]}>Order journey</Text>
          <StageTimeline order={o} />
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Text style={[text.h2, styles.blockTitle]}>Pickup</Text>
        <InfoRow icon="calendar" title={dayDate(o.pickup.date)} detail={slot?.label ?? ''} />
        <InfoRow icon="mapPin" title={address?.label ?? 'Address'} detail={address ? `${address.line1}, ${address.line2}, ${address.city}` : ''} />
      </Card>

      <Card style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={text.h2}>Garments</Text>
          <Text style={text.caption}>{totals.garments ? `${totals.garments} pieces` : 'By weight'}</Text>
        </View>
        {totals.lines.map((l) => (
          <View key={l.item.id} style={styles.line}>
            <Text style={[text.bodyStrong, { flex: 1 }]}>{l.item.name}</Text>
            <Text style={text.caption}>
              {l.qty} {l.item.unit === 'kg' ? 'kg' : '×'} {money(l.item.price)}
            </Text>
            <Text style={styles.lineAmount}>{money(l.amount)}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.block}>
        <Text style={[text.h2, styles.blockTitle]}>Payment</Text>
        <KeyValue label="Subtotal" value={money(totals.subtotal)} />
        <KeyValue label="Delivery" value={totals.delivery ? money(totals.delivery) : 'Free'} />
        {totals.discount ? <KeyValue label="Discount" value={`− ${money(totals.discount)}`} valueColor="#0D7A21" /> : null}
        <Divider />
        <KeyValue label="Total" value={money(totals.total)} strong />
        <View style={styles.payRow}>
          <Text style={text.caption}>{o.payment.method}</Text>
          <StatusBadge
            label={o.payment.status === 'paid' ? 'Paid' : o.payment.status === 'pending' ? 'Due on delivery' : 'Not charged'}
            tone={
              o.payment.status === 'paid'
                ? { fg: '#0D7A21', bg: colors.successTint }
                : o.payment.status === 'pending'
                  ? { fg: app.warning, bg: app.warningTint }
                  : { fg: colors.inkSoft, bg: '#EFEDE8' }
            }
          />
        </View>
      </Card>

      {o.status === 'delivered' ? (
        <Card style={styles.block}>
          <Text style={[text.h2, styles.blockTitle]}>How was your laundry?</Text>
          <Text style={[text.caption, { marginBottom: space.md }]}>
            Tap a star to rate the wash freshness, fold quality, and delivery speed.
          </Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <View key={star} style={styles.starWrap}>
                <Icon name="star" size={24} color="#FEC837" strokeWidth={2} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {o.status === 'delivered' ? (
          <Button label="Book again" icon="plus" variant="dark" onPress={() => navigation.navigate('Main', { screen: 'Book' })} />
        ) : null}
        <Button label="Get help with this order" variant="outline" icon="headset" onPress={() => navigation.navigate('Support')} />
        {cancellable ? <Button label="Cancel pickup" variant="dark" onPress={() => setConfirmCancel(true)} /> : null}
      </View>

      <BottomSheet visible={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <Text style={text.h1}>Cancel this pickup?</Text>
        <Text style={[text.body, { marginTop: 4 }]} numberOfLines={1}>Order #{o.id} hasn&apos;t been collected yet, no charge applies.</Text>
        <View style={styles.sheetButtons}>
          <Button label="Keep it" variant="outline" onPress={() => setConfirmCancel(false)} style={{ flex: 1 }} />
          <Button label="Cancel pickup" variant="dark" loading={cancelling} onPress={cancel} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}

function InfoRow({ icon, title, detail }: { icon: 'calendar' | 'mapPin'; title: string; detail: string }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={18} color={colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={text.bodyStrong}>{title}</Text>
        {detail ? <Text style={text.caption}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 2px 4px rgba(10, 28, 62, 0.02), 0 8px 24px rgba(10, 28, 62, 0.05)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 };

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  heroCard: {
    borderRadius: shape.card,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    ...soft,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  statusDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  heroAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  heroArt: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroService: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  heroMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  block: {
    marginTop: space.md,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    padding: space.lg,
    ...soft,
  },
  blockTitle: { marginBottom: space.md },
  blockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  lineAmount: { ...text.bodyStrong, minWidth: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
  info: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.sm },
  infoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5EFE6', alignItems: 'center', justifyContent: 'center' },
  actions: { gap: space.md, marginTop: space.xl },
  sheetButtons: { flexDirection: 'row', gap: space.md, marginTop: space.xxl },
  deliveredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#E8F8EE',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#C6EDD3',
    padding: space.lg,
    marginTop: space.md,
  },
  deliveredIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0D7A21',
  },
  deliveredSub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(10, 28, 62, 0.75)',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: space.xs,
  },
  starWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
