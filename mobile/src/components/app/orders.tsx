import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { date, money, plural } from '../../lib/format';
import { computeTotals, serviceById } from '../../services/mock/pricing.service';
import { stageIndex } from '../../services/mock/orders.service';
import { colors, fonts, shape } from '../../theme';
import { ORDER_STAGES, type Order, type OrderStage } from '../../types/models';
import { ART, ART_TINT } from './art';
import { Icon } from './Icon';
import { ORDER_STATUS, STAGE_LABEL } from './status';

export type OrderTheme = {
  bg: string;
  cardBg: string;
  border: string;
  accent: string;
  dot: string;
  pillBg: string;
  text: string;
  sub: string;
  arrowBg: string;
  arrowColor: string;
};

export const ORDER_CARD_THEMES: OrderTheme[] = [
  // Step 1: Sunset Orange
  {
    bg: '#FFA742',
    cardBg: '#FFFFFF',
    border: 'rgba(254, 135, 1, 0.32)',
    accent: '#FFA742',
    dot: '#FFA742',
    pillBg: 'rgba(254, 135, 1, 0.12)',
    text: '#0A1C3E',
    sub: '#64748B',
    arrowBg: '#FFA742',
    arrowColor: '#FFFFFF',
  },
  // Step 2: Ocean Blue
  {
    bg: '#54B6F8',
    cardBg: '#FFFFFF',
    border: 'rgba(2, 132, 199, 0.30)',
    accent: '#0284C7',
    dot: '#0284C7',
    pillBg: 'rgba(2, 132, 199, 0.12)',
    text: '#0A1C3E',
    sub: '#64748B',
    arrowBg: '#0284C7',
    arrowColor: '#FFFFFF',
  },
  // Step 3: Royal Purple
  {
    bg: '#A78BFA',
    cardBg: '#FFFFFF',
    border: 'rgba(139, 92, 246, 0.30)',
    accent: '#8B5CF6',
    dot: '#8B5CF6',
    pillBg: 'rgba(139, 92, 246, 0.12)',
    text: '#0A1C3E',
    sub: '#64748B',
    arrowBg: '#8B5CF6',
    arrowColor: '#FFFFFF',
  },
  // Step 4: Golden Sun Yellow
  {
    bg: '#FED843',
    cardBg: '#FFFFFF',
    border: 'rgba(229, 161, 0, 0.35)',
    accent: '#E5A100',
    dot: '#E5A100',
    pillBg: 'rgba(229, 161, 0, 0.14)',
    text: '#0A1C3E',
    sub: '#64748B',
    arrowBg: '#E5A100',
    arrowColor: '#FFFFFF',
  },
  // Step 5: Emerald Green
  {
    bg: '#62D487',
    cardBg: '#FFFFFF',
    border: 'rgba(16, 185, 129, 0.30)',
    accent: '#10B981',
    dot: '#10B981',
    pillBg: 'rgba(16, 185, 129, 0.12)',
    text: '#0A1C3E',
    sub: '#64748B',
    arrowBg: '#10B981',
    arrowColor: '#FFFFFF',
  },
];

/**
 * Universal 5-step color system matching the order journey:
 * - Step 1: Collected / Intake / Drop-off & Collection / Payment Pending -> Sunset Orange (#FFA742, dot #F97316)
 * - Step 2: Washing & Drying / Accepted / Confirmed -> Ocean Blue (#54B6F8, dot #0284C7)
 * - Step 3: Ironing & Packing / Processing -> Royal Purple (#A78BFA, dot #8B5CF6)
 * - Step 4: Ready for Collection / Out for Delivery / Customer Verification -> Sunny Yellow (#FED843, dot #E5A100)
 * - Step 5: Delivered / Completed -> Fresh Green (#62D487, dot #10B981)
 * - Stopped: Cancelled / Rejected -> Coral Red (#F87C87, dot #EF4444)
 */
export function getOrderTheme(status: string = '', index: number = 0): OrderTheme {
  const norm = status.toUpperCase().replace(/\s+/g, '_');

  // 1. Delivered / Completed (Step 5) -> Soft Fresh Green
  if (norm === 'DELIVERED' || norm === 'COMPLETED') {
    return {
      bg: '#62D487',
      cardBg: '#FFFFFF',
      border: 'rgba(16, 185, 129, 0.32)',
      accent: '#10B981',
      dot: '#10B981',
      pillBg: 'rgba(16, 185, 129, 0.12)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#10B981',
      arrowColor: '#FFFFFF',
    };
  }

  // 2. Cancelled / Rejected / Refunded (Stopped) -> Soft Coral Brand Red
  if (
    norm === 'CANCELLED' ||
    norm === 'REJECTED' ||
    norm === 'REFUNDED' ||
    norm === 'REFUND_PENDING' ||
    norm === 'STOPPED'
  ) {
    return {
      bg: '#F87C87',
      cardBg: '#FFFFFF',
      border: 'rgba(239, 68, 68, 0.32)',
      accent: '#EF4444',
      dot: '#EF4444',
      pillBg: 'rgba(239, 68, 68, 0.12)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#EF4444',
      arrowColor: '#FFFFFF',
    };
  }

  // 3. Step 4: Out for Delivery / Ready for Collection / Customer Verification -> Sunny Yellow / Gold
  if (
    norm === 'OUT_FOR_DELIVERY' ||
    norm === 'READY_FOR_DELIVERY' ||
    norm === 'AWAITING_CUSTOMER_VERIFICATION' ||
    norm === 'READY' ||
    norm === 'DISPATCHED'
  ) {
    return {
      bg: '#FED843',
      cardBg: '#FFFFFF',
      border: 'rgba(229, 161, 0, 0.35)',
      accent: '#E5A100',
      dot: '#E5A100',
      pillBg: 'rgba(229, 161, 0, 0.14)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#E5A100',
      arrowColor: '#FFFFFF',
    };
  }

  // 4. Step 3: Ironing & Packing / Processing -> Royal Purple
  if (
    norm === 'IRONING_PACKING' ||
    norm === 'PROCESSING' ||
    norm === 'IRONING' ||
    norm === 'PACKING'
  ) {
    return {
      bg: '#A78BFA',
      cardBg: '#FFFFFF',
      border: 'rgba(139, 92, 246, 0.32)',
      accent: '#8B5CF6',
      dot: '#8B5CF6',
      pillBg: 'rgba(139, 92, 246, 0.12)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#8B5CF6',
      arrowColor: '#FFFFFF',
    };
  }

  // 5. Step 2: Washing & Drying / Accepted / Confirmed -> Ocean Blue
  if (
    norm === 'WASHING_DRYING' ||
    norm === 'ACCEPTED' ||
    norm === 'PICKUP_CONFIRMED' ||
    norm === 'WASHING' ||
    norm === 'DRYING'
  ) {
    return {
      bg: '#54B6F8',
      cardBg: '#FFFFFF',
      border: 'rgba(2, 132, 199, 0.32)',
      accent: '#0284C7',
      dot: '#0284C7',
      pillBg: 'rgba(2, 132, 199, 0.12)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#0284C7',
      arrowColor: '#FFFFFF',
    };
  }

  // 6. Step 1: Collected / Intake / Drop-off / Payment Pending / Request Submitted -> Sunset Orange
  if (
    norm === 'COLLECTED' ||
    norm === 'PAYMENT_PENDING' ||
    norm === 'REQUEST_SUBMITTED' ||
    norm === 'AWAITING_STAFF_ACCEPTANCE' ||
    norm === 'PICKUP_SCHEDULED' ||
    norm === 'PENDING' ||
    norm === 'PAYMENT_COMPLETED'
  ) {
    return {
      bg: '#FFA742',
      cardBg: '#FFFFFF',
      border: 'rgba(254, 135, 1, 0.32)',
      accent: '#FFA742',
      dot: '#FFA742',
      pillBg: 'rgba(254, 135, 1, 0.12)',
      text: '#0A1C3E',
      sub: '#64748B',
      arrowBg: '#FFA742',
      arrowColor: '#FFFFFF',
    };
  }

  // Fallback to activeThemes index modulo if unknown
  return ORDER_CARD_THEMES[Math.abs(index) % ORDER_CARD_THEMES.length];
}

export function formatCardDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (isNaN(d.getTime())) return '';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function getStatusDot(status: string): string {
  const norm = status.toUpperCase().replace(/\s+/g, '_');
  if (norm === 'DELIVERED' || norm === 'COMPLETED' || norm === 'PAYMENT_COMPLETED' || norm === 'PAID') return '#10B981'; // Green
  if (norm === 'PAYMENT_PENDING' || norm === 'PENDING' || norm === 'REQUIRED') return '#FE8701'; // Orange
  if (norm === 'CANCELLED' || norm === 'REJECTED' || norm === 'REFUNDED' || norm === 'REFUND_PENDING') return '#EF4444'; // Red
  if (norm === 'OUT_FOR_DELIVERY' || norm === 'READY_FOR_DELIVERY' || norm === 'AWAITING_CUSTOMER_VERIFICATION' || norm === 'READY' || norm === 'DISPATCHED') return '#E5A100'; // Yellow
  if (norm === 'IRONING_PACKING' || norm === 'PROCESSING' || norm === 'IRONING' || norm === 'PACKING') return '#8B5CF6'; // Purple
  if (norm === 'WASHING_DRYING' || norm === 'ACCEPTED' || norm === 'PICKUP_CONFIRMED' || norm === 'WASHING' || norm === 'DRYING') return '#0284C7'; // Blue
  return '#F97316'; // Step 1 Orange
}

/** A small round crop of the service's illustration. */
export function ServiceThumb({ art, size = 36 }: { art: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: ART_TINT[art] ?? '#FAF9F6' }}>
      <Image source={ART[art]} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

/** Compact order summary matching the modern pill card design from the reference image. */
export function OrderRow({
  order,
  onPress,
  index = 0,
}: {
  order: Order;
  onPress: () => void;
  index?: number;
}) {
  const service = serviceById(order.serviceId);
  const totals = computeTotals(order.items, order.discount);
  const status = ORDER_STATUS[order.status];
  const count = totals.garments ? plural(totals.garments, 'garment') : `${totals.lines.reduce((s, l) => s + l.qty, 0)} kg`;
  const theme = getOrderTheme(order.status, index);
  const dateKicker = formatCardDate(order.placedAt);
  const dotColor = getStatusDot(order.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order #${order.id}, ${service.name}, ${status.label}, ${money(totals.total)}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.cardBg ?? '#FFFFFF',
          borderColor: theme.border ?? '#EFECE6',
          borderWidth: 1.5,
        },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 },
      ]}
    >
      {/* ── Top row: date + title on left, circular arrow on right ── */}
      <View style={styles.topRow}>
        <View style={styles.topMain}>
          {dateKicker ? <Text style={[styles.dateKicker, { color: theme.sub }]}>{dateKicker}</Text> : null}
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            Order #{order.id}
          </Text>
          <Text style={[styles.subtitle, { color: theme.sub }]} numberOfLines={1}>
            {service.name} · {count}
          </Text>
        </View>
        <View style={[styles.arrowCircle, { backgroundColor: theme.arrowBg }]}>
          <Icon name="arrowUpRight" size={17} color={theme.arrowColor} strokeWidth={2.4} />
        </View>
      </View>

      {/* ── Bottom row: big amount on left, 3 overlapping avatar circles on right ── */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomMain}>
          <Text style={[styles.amount, { color: theme.text }]}>{money(totals.total)}</Text>
          <View style={[styles.statusPill, { backgroundColor: theme.pillBg }]}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusText, { color: theme.text }]} numberOfLines={1}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.avatarStack}>
          <View style={[styles.avatarCircle, { zIndex: 1 }]}>
            <ServiceThumb art={service.art} size={34} />
          </View>
          <View style={[styles.avatarCircle, { zIndex: 2, marginLeft: -12 }]}>
            <Icon name="shirt" size={17} color={colors.ink} />
          </View>
          <View style={[styles.avatarCircle, { zIndex: 3, marginLeft: -12 }]}>
            <Icon name="bag" size={15} color={colors.ink} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const STAGE_META: Record<
  OrderStage,
  {
    title: string;
    icon: 'bag' | 'droplet' | 'shirt' | 'truck' | 'sparkle' | 'package';
    desc: (done: boolean, now: boolean, order: Order) => string;
  }
> = {
  collected: {
    title: 'Drop-off & Collection',
    icon: 'bag',
    desc: (done) => (done ? 'Clothes collected & verified at counter / doorstep' : 'Show QR code at counter to hand over clothes'),
  },
  washing_drying: {
    title: 'Washing & Drying',
    icon: 'droplet',
    desc: (done, now) =>
      done
        ? 'Washed & gentle tumble dried'
        : now
          ? 'Deep fabric wash & gentle tumble drying in progress'
          : 'Deep fabric wash and gentle tumble drying',
  },
  ironing_packing: {
    title: 'Ironing & Packing',
    icon: 'shirt',
    desc: (done, now) =>
      done
        ? 'Steam pressed & protective packaged'
        : now
          ? 'Steam press & garment packaging in progress'
          : 'Steam press & protective packaging',
  },
  out_for_delivery: {
    title: 'Out for Delivery',
    icon: 'truck',
    desc: (done, now) =>
      done
        ? 'Dispatched & delivered to destination'
        : now
          ? 'Delivery partner on the way to your door / counter'
          : 'Dispatched for doorstep delivery or counter collection',
  },
  delivered: {
    title: 'Delivered',
    icon: 'truck',
    desc: (done, _, order) =>
      done
        ? order.deliveredAt
          ? `Delivered on ${date(order.deliveredAt)} · All pieces verified`
          : 'Handed over · All pieces verified'
        : 'Final handover & piece confirmation',
  },
};

export const STAGE_PALETTES: Record<
  OrderStage,
  {
    base: string;
    dark: string;
    light: string;
    border: string;
  }
> = {
  collected: {
    base: '#F97316', // Sunset Orange
    dark: '#C2410C',
    light: '#FFF7ED',
    border: '#FED7AA',
  },
  washing_drying: {
    base: '#0284C7', // Fresh Ocean Blue
    dark: '#0369A1',
    light: '#F0F9FF',
    border: '#BAE6FD',
  },
  ironing_packing: {
    base: '#8B5CF6', // Steam Violet / Royal Purple
    dark: '#6D28D9',
    light: '#F5F3FF',
    border: '#DDD6FE',
  },
  out_for_delivery: {
    base: '#E5A100', // Golden Sun Yellow / Transit Amber
    dark: '#9A6700',
    light: '#FFFBEA',
    border: '#FDE68A',
  },
  delivered: {
    base: '#10B981', // Emerald Success Green
    dark: '#047857',
    light: '#ECFDF5',
    border: '#A7F3D0',
  },
};

/** Five customer-centric segments; done ones fill in stage colors, the current one glows. For dark or light cards. */
export function StageProgress({ order, dark }: { order: Order; dark?: boolean }) {
  const current = stageIndex(order.status);
  return (
    <View style={styles.segments} accessibilityLabel={`Step ${current + 1} of ${ORDER_STAGES.length}`}>
      {ORDER_STAGES.map((s, i) => {
        const pal = STAGE_PALETTES[s];
        const isDone = i < current || order.status === 'delivered';
        const isNow = i === current && order.status !== 'delivered';
        return (
          <View
            key={s}
            style={[
              styles.segment,
              { backgroundColor: dark ? 'rgba(255,255,255,0.16)' : '#EAE6DF' },
              isDone && { backgroundColor: dark ? '#FFFFFF' : pal.base },
              isNow && { backgroundColor: pal.base, flex: 2.2 },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Clean 5-step customer journey for the order details screen with distinctive step colors & heavy typography. */
export function StageTimeline({ order }: { order: Order }) {
  const current = stageIndex(order.status);
  return (
    <View>
      {ORDER_STAGES.map((s, i) => {
        const done = i < current || order.status === 'delivered';
        const now = i === current && order.status !== 'delivered';
        const last = i === ORDER_STAGES.length - 1;
        const meta = STAGE_META[s];
        const pal = STAGE_PALETTES[s];
        return (
          <View key={s} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View
                style={[
                  styles.tlDot,
                  done && {
                    backgroundColor: pal.base,
                    ...(Platform.OS === 'web'
                      ? ({ boxShadow: `0 3px 8px ${pal.base}36` } as object)
                      : { shadowColor: pal.base, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 2 }),
                  },
                  now && {
                    backgroundColor: pal.base,
                    borderWidth: 3.5,
                    borderColor: pal.light,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    marginHorizontal: -2,
                    ...(Platform.OS === 'web'
                      ? ({ boxShadow: `0 4px 12px ${pal.base}50` } as object)
                      : { shadowColor: pal.base, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 3 }),
                  },
                  !done && !now && {
                    backgroundColor: pal.light,
                    borderWidth: 1.5,
                    borderColor: pal.border,
                  },
                ]}
              >
                {done ? (
                  <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.8} />
                ) : (
                  <Icon name={meta.icon} size={12} color={now ? '#FFFFFF' : pal.base} strokeWidth={2.4} />
                )}
              </View>
              {!last ? (
                <View
                  style={[
                    styles.tlLine,
                    (done || now) && i < current && { backgroundColor: pal.base },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.tlText}>
              <View style={styles.tlTitleRow}>
                <Text
                  style={[
                    styles.tlTitle,
                    !done && !now && { color: '#4B5565', fontFamily: fonts.bold },
                    now && { color: pal.dark, fontFamily: fonts.extrabold },
                    done && { color: '#0A1C3E', fontFamily: fonts.extrabold },
                  ]}
                >
                  {meta.title}
                </Text>


              </View>

            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.card,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    minHeight: 168,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(10, 28, 62, 0.11), 0 2px 6px rgba(10, 28, 62, 0.05)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  topMain: {
    flex: 1,
  },
  dateKicker: {
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 2,
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 20,
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
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

  segments: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  tlRow: { flexDirection: 'row', gap: 14 },
  tlRail: { alignItems: 'center', width: 22 },
  tlDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E8EEF8', alignItems: 'center', justifyContent: 'center' },
  tlDotDone: { backgroundColor: colors.navy },
  tlDotNow: { backgroundColor: '#FEC837', borderWidth: 4, borderColor: '#FFF1C2' },
  tlLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: '#E8EEF8', marginVertical: 3 },
  tlLineDone: { backgroundColor: colors.navy },
  tlText: { flex: 1, paddingBottom: 22, paddingTop: 2 },
  tlTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tlTitle: { fontFamily: fonts.extrabold, fontSize: 15.5, color: '#0A1C3E', letterSpacing: -0.3 },
  tlNowChip: { paddingHorizontal: 8, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tlNowChipText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.2, textTransform: 'uppercase' },
  tlDoneChip: { paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center' },
  tlDoneChipText: { fontFamily: fonts.bold, fontSize: 10, color: '#047857', letterSpacing: 0.2, textTransform: 'uppercase' },
  tlSub: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: '#334155', marginTop: 3 },
});
