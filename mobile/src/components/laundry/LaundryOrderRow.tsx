import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLaundryState } from '../../laundry/hooks';
import { money, plural } from '../../lib/format';
import { STATUS_COPY } from '../../mock/engine/lifecycle';
import { get5StepJourney } from './OrderTimeline';
import type { LaundryOrder, Location } from '../../mock/types';
import { fonts, shape } from '../../theme';
import { Icon } from '../app/Icon';
import { formatCardDate, getOrderTheme, ServiceThumb } from '../app/orders';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const STEP_SEGMENT_COLORS = ['#FFA742', '#0284C7', '#8B5CF6', '#E5A100', '#10B981'];

function getOrderStatusTitle(order: LaundryOrder): string {
  switch (order.status) {
    case 'PAYMENT_PENDING':
      return 'Payment Pending';
    case 'PAYMENT_COMPLETED':
    case 'AWAITING_STAFF_ACCEPTANCE':
      return order.serviceMode === 'HOME_PICKUP' ? 'Pickup Scheduled' : 'Drop-off Ready';
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return 'Collected';
    case 'PROCESSING':
      return 'In Progress';
    case 'READY_FOR_DELIVERY':
      return order.serviceMode === 'HOME_PICKUP' ? 'Out for Delivery' : 'Ready for Pickup';
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return 'Delivery Ready';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    case 'REJECTED':
      return 'Rejected';
    case 'REFUND_PENDING':
      return 'Refund Pending';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return 'Active';
  }
}

function getOrderStatusBadgeTheme(status: string) {
  const norm = status.toUpperCase().replace(/\s+/g, '_');
  if (norm === 'DELIVERED' || norm === 'COMPLETED') {
    return {
      dot: '#16A34A',
      bg: '#F0FDF4',
      text: '#15803D',
    };
  }
  if (norm === 'CANCELLED' || norm === 'REJECTED' || norm === 'REFUNDED') {
    return {
      dot: '#DC2626',
      bg: '#FEF2F2',
      text: '#DC2626',
    };
  }
  if (norm === 'PAYMENT_PENDING' || norm === 'PENDING') {
    return {
      dot: '#FFA742',
      bg: '#FFF7ED',
      text: '#C2410C',
    };
  }
  if (norm === 'READY_FOR_DELIVERY' || norm === 'AWAITING_CUSTOMER_VERIFICATION') {
    return {
      dot: '#D97706',
      bg: '#FEFCE8',
      text: '#B45309',
    };
  }
  // Processing / Accepted / Awaiting Drop-off / In Progress
  return {
    dot: '#0284C7',
    bg: '#F0F9FF',
    text: '#0369A1',
  };
}

function getLaundryServiceArt(order: LaundryOrder, stepIndex: number): string {
  if (order.status === 'DELIVERED') return 'packing';
  if (order.status === 'CANCELLED' || order.status === 'REJECTED' || order.status === 'REFUNDED') return 'collecting';
  if (
    order.status === 'READY_FOR_DELIVERY' ||
    order.status === 'AWAITING_CUSTOMER_VERIFICATION' ||
    order.status === 'AWAITING_STAFF_ACCEPTANCE'
  ) {
    return 'delivery';
  }
  if (order.status === 'PROCESSING') {
    return stepIndex >= 3 ? 'ironing' : 'drying';
  }
  if (order.status === 'ACCEPTED' || order.status === 'PICKUP_CONFIRMED') {
    return 'ironing';
  }
  return 'collecting';
}

/** One laundry order in a list: styled with clean top-right arrow and bottom-right 3 overlapping avatar circles. */
export function LaundryOrderRow({
  order,
  location,
  onPress,
  hint,
  index = 0,
}: {
  order: LaundryOrder;
  location?: Location;
  onPress: () => void;
  hint?: string;
  index?: number;
}) {
  const status = STATUS_COPY[order.status];
  const theme = getOrderTheme(order.status, index);
  const dateKicker = formatCardDate(order.createdAt);
  const state = useLaundryState();
  const progress = get5StepJourney(order, state);
  const isStopped = order.status === 'REJECTED' || order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';
  const statusTitle = getOrderStatusTitle(order);
  const badgeTheme = getOrderStatusBadgeTheme(order.status);
  const serviceArt = getLaundryServiceArt(order, progress.stepIndex);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id}, ${statusTitle}, ${money(order.total)}`}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border ?? '#EAE6DB',
        },
        webCursor,
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 },
      ]}
    >
      {/* ── Top right circular arrow button ── */}
      <View style={[styles.arrowCircle, { backgroundColor: theme.accent ?? theme.arrowBg }]}>
        <Icon name="arrowUpRight" size={17} color="#FFFFFF" strokeWidth={2.4} />
      </View>

      <View style={styles.cardContent}>
        {/* Top: date, status badge, title, pieces */}
        <View style={styles.topSection}>
          <View style={styles.headerMetaRow}>
            {dateKicker ? <Text style={[styles.dateKicker, { color: theme.sub }]}>{dateKicker}</Text> : null}
            <View style={[styles.statusBadge, { backgroundColor: badgeTheme.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeTheme.dot }]} />
              <Text style={[styles.statusBadgeText, { color: badgeTheme.text }]}>
                {statusTitle}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            Order {order.id}
          </Text>

          <Text style={[styles.piecesText, { color: theme.sub }]}>
            {plural(order.pieces, 'piece')}
          </Text>
        </View>

        {/* Bottom row: amount + progress on left, 3 overlapping avatar circles on right */}
        <View style={styles.bottomRow}>
          <View style={styles.bottomMain}>
            <Text style={[styles.amount, { color: theme.text }]}>{money(order.total)}</Text>
            {hint ? (
              <View
                style={[
                  styles.hintPill,
                  order.status === 'PAYMENT_PENDING'
                    ? { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }
                    : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                ]}
              >
                <Icon
                  name="info"
                  size={11.5}
                  color={order.status === 'PAYMENT_PENDING' ? '#EA580C' : '#0284C7'}
                  strokeWidth={2.4}
                />
                <Text
                  style={[
                    styles.hintText,
                    { color: order.status === 'PAYMENT_PENDING' ? '#9A3412' : '#0369A1' },
                  ]}
                  numberOfLines={1}
                >
                  {hint}
                </Text>
              </View>
            ) : null}

            {/* 5-step segmented progress track: exact step color sequence; all green when delivered */}
            {!isStopped ? (
              <View style={styles.track} accessibilityElementsHidden>
                {progress.steps.slice(0, 5).map((st, i) => {
                  const segColor = isDelivered
                    ? '#10B981'
                    : st.state === 'done' || st.state === 'now'
                      ? (STEP_SEGMENT_COLORS[i] ?? theme.accent)
                      : '#E2E8F0';

                  return (
                    <View
                      key={st.key}
                      style={[
                        styles.seg,
                        { backgroundColor: segColor },
                        st.state === 'now' && !isDelivered && styles.segNow,
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>

          {/* 3 overlapping circular avatar badges matching the reference image */}
          <View style={styles.avatarStack}>
            <View style={[styles.avatarCircle, { zIndex: 1 }]}>
              <ServiceThumb art={serviceArt} size={34} />
            </View>
            <View style={[styles.avatarCircle, { zIndex: 2, marginLeft: -12 }]}>
              <Icon name="shirt" size={17} color="#0A1C3E" strokeWidth={1.8} />
            </View>
            <View style={[styles.avatarCircle, { zIndex: 3, marginLeft: -12 }]}>
              <Icon name="bag" size={15} color="#0A1C3E" strokeWidth={1.8} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.card,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    minHeight: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(10, 28, 62, 0.06), 0 2px 6px rgba(10, 28, 62, 0.03)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }),
  },
  arrowCircle: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 }),
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    paddingRight: 56,
    marginBottom: 14,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  dateKicker: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  statusBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  piecesText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomMain: {
    flex: 1,
  },
  amount: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  statusDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  seg: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  segNow: {
    width: 20,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 25,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E5DD',
    alignSelf: 'flex-start',
    marginTop: 6,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 3px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }),
  },
  hintText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0A1C3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
