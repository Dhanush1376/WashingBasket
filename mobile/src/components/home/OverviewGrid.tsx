import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { money, plural } from '../../lib/format';
import { isOpen, STATUS_COPY } from '../../mock/engine/lifecycle';
import { get5StepJourney } from '../laundry/OrderTimeline';
import { findLocation, ordersForCustomer } from '../../mock/engine/selectors';
import type { LaundryOrder } from '../../mock/types';
import { app, colors, fonts, space } from '../../theme';
import { Icon, type IconName } from '../app/Icon';

const GAP = 9;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

export type NextPickup = { when: string; slot: string; service: string; status: string } | null;

type Tone = { bg: string; fg: string; soft: string; tagBg: string; dot: string; dotFg: string; light?: boolean; accent?: string };
const LIGHT = (accent: string): Tone => ({ bg: '#FFFFFF', fg: colors.ink, soft: colors.inkSoft, tagBg: '#F4F2EE', dot: '#0A1C3E', dotFg: '#FFFFFF', light: true, accent });
const TONES = {
  active: { bg: '#0A1C3E', fg: '#FFFFFF', soft: 'rgba(255,255,255,0.66)', tagBg: 'rgba(255,255,255,0.12)', dot: '#FFFFFF', dotFg: '#0A1C3E', accent: '#FFA742' } as Tone,
  completed: LIGHT('#62D487'),
  pickup: LIGHT(colors.navy),
  wallet: { bg: '#FFA742', fg: colors.ink, soft: 'rgba(10, 28, 62, 0.72)', tagBg: 'rgba(255, 255, 255, 0.55)', dot: '#0A1C3E', dotFg: '#FFFFFF' } as Tone,
};

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 2px 4px rgba(10, 28, 62, 0.03), 0 8px 20px rgba(10, 28, 62, 0.06)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 };

function getOrderAction(o: LaundryOrder): { title: string; subtitle: string; isUrgent: boolean; icon: IconName } {
  switch (o.status) {
    case 'PAYMENT_PENDING':
      return {
        title: `Pay ${money(o.total)} to unlock your QR`,
        subtitle: 'Payment pending',
        isUrgent: true,
        icon: 'wallet',
      };

    case 'AWAITING_STAFF_ACCEPTANCE':
      return {
        title: o.serviceMode === 'HOME_PICKUP' ? 'Show QR to pickup partner' : 'Show Drop-off QR at counter',
        subtitle: 'Drop-off & Collection',
        isUrgent: true,
        icon: 'bag',
      };
    case 'ACCEPTED':
    case 'PICKUP_CONFIRMED':
      return {
        title: 'Washing & Drying',
        subtitle: 'In washing cycle',
        isUrgent: false,
        icon: 'droplet',
      };
    case 'PROCESSING':
      return {
        title: 'Ironing & Packing',
        subtitle: 'Steam pressing & packing',
        isUrgent: false,
        icon: 'shirt',
      };
    case 'READY_FOR_DELIVERY':
      return {
        title: o.serviceMode === 'HOME_PICKUP' ? 'Out for delivery' : 'Ready for collection',
        subtitle: o.serviceMode === 'HOME_PICKUP' ? 'On the way to your door' : 'Ready at campus counter',
        isUrgent: false,
        icon: o.serviceMode === 'HOME_PICKUP' ? 'truck' : 'package',
      };
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return {
        title: o.verification ? 'Show delivery QR' : 'Check your clothes',
        subtitle: 'Delivery handover',
        isUrgent: true,
        icon: 'check',
      };
    default:
      return {
        title: STATUS_COPY[o.status].label,
        subtitle: STATUS_COPY[o.status].customer[o.serviceMode],
        isUrgent: false,
        icon: 'shirt',
      };
  }
}

export function OverviewGrid({
  active,
  completed,
  balance,
  pending,
  next,
  onActive,
  onCompleted,
  onWallet,
  onNext,
  onOpenOrder,
}: {
  active: { count: number; leadId?: string; leadStatus?: string; leadNext?: string; leadArt?: string; delivery?: string };
  completed: number;
  balance: string;
  pending?: string;
  next: NextPickup;
  onActive: () => void;
  onCompleted: () => void;
  onWallet: () => void;
  onNext: () => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  const a = TONES.active;
  const p = TONES.pickup;
  const c = TONES.completed;
  const w = TONES.wallet;

  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const laundryOpen = state && customer ? ordersForCustomer(state, customer.id).filter((o) => isOpen(o.status)) : [];
  const totalCount = laundryOpen.length > 0 ? laundryOpen.length : active.count;

  // Find first order that needs urgent action, or default to 0
  const urgentIdx = laundryOpen.findIndex((o) => ['PAYMENT_PENDING', 'AWAITING_STAFF_ACCEPTANCE', 'AWAITING_CUSTOMER_VERIFICATION'].includes(o.status));
  const [selectedIdx, setSelectedIdx] = useState(urgentIdx >= 0 ? urgentIdx : 0);
  const activeIdx = Math.max(0, Math.min(selectedIdx, Math.max(0, laundryOpen.length - 1)));
  const currentOrder = laundryOpen[activeIdx];
  const orderInfo = currentOrder ? getOrderAction(currentOrder) : null;
  const progress = currentOrder ? get5StepJourney(currentOrder, state) : null;
  const orderSteps = progress ? progress.steps.slice(0, 5) : [];
  const orderAt = progress ? progress.stepIndex - 1 : 0;
  const orderLoc = currentOrder && state ? findLocation(state, currentOrder.locationId) : null;

  const hasAnyUrgent = laundryOpen.some((o) => ['PAYMENT_PENDING', 'AWAITING_STAFF_ACCEPTANCE', 'AWAITING_CUSTOMER_VERIFICATION'].includes(o.status));

  return (
    <View style={styles.wrap}>
      {/* ── Active orders: Unified dark card arranged cleanly like Image 2 ── */}
      <View style={[styles.tile, styles.hero, { backgroundColor: a.bg }]}>
        {/* Top Header Row with status kicker and order switcher tabs */}
        <View style={styles.topRow}>
          <View style={[styles.tag, { backgroundColor: a.tagBg }]}>
            <View
              style={[
                styles.tagDot,
                { backgroundColor: hasAnyUrgent ? colors.orange : totalCount ? colors.success : 'rgba(255,255,255,0.4)' },
              ]}
            />
            <Text style={[styles.tagText, { color: a.fg }]}>
              {hasAnyUrgent ? 'Needs you' : totalCount ? 'In progress' : 'Orders'}
            </Text>
          </View>

          {/* Multi-Order Tabs Switcher aligned to top right */}
          {laundryOpen.length > 1 ? (
            <View style={styles.tabsRow}>
              {laundryOpen.map((ord, idx) => {
                const isSelected = idx === activeIdx;
                const info = getOrderAction(ord);
                const chipLabel =
                  ord.status === 'PAYMENT_PENDING'
                    ? `${ord.id} · Pay`
                    : ord.status === 'PROCESSING'
                    ? `${ord.id} · Washing`
                    : ord.status === 'READY_FOR_DELIVERY'
                    ? `${ord.id} · Ready`
                    : ord.id;

                return (
                  <Pressable
                    key={ord.id}
                    onPress={() => setSelectedIdx(idx)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Switch to order ${ord.id}`}
                    style={[styles.orderTab, isSelected && styles.orderTabActive, webCursor]}
                  >
                    <View
                      style={[
                        styles.tabDot,
                        { backgroundColor: info.isUrgent ? colors.orange : isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
                      ]}
                    />
                    <Text style={[styles.orderTabText, isSelected && styles.orderTabTextActive]}>
                      {chipLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Selected Order Content: Arranged in clean 2-column layout matching Image 2 */}
        {currentOrder && orderInfo ? (
          <View style={[styles.orderBody, styles.legacyRow]}>
            <Pressable
              onPress={onActive}
              accessibilityRole="button"
              accessibilityLabel={`${totalCount} active orders`}
              hitSlop={8}
              style={webCursor}
            >
              <Text style={[styles.big, { color: a.fg }]}>{totalCount}</Text>
              <Text style={[styles.caption, { color: a.soft }]}>
                {totalCount === 1 ? 'Active order' : 'Active orders'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => (onOpenOrder ? onOpenOrder(currentOrder.id) : onActive())}
              accessibilityRole="button"
              accessibilityLabel={`${orderInfo.title}. ${currentOrder.id}`}
              style={[styles.lead, webCursor]}
            >
              <View style={styles.leadTop}>
                <View style={styles.leadText}>
                  <Text style={[styles.personLabel, { color: a.soft }]} numberOfLines={1}>
                    #{currentOrder.id}{currentOrder.status === 'PAYMENT_PENDING' ? ' · Payment pending' : orderLoc ? ` · ${orderLoc.shortName}` : ''}
                  </Text>
                  <Text style={[styles.personValue, { color: a.fg }]} numberOfLines={1} adjustsFontSizeToFit>
                    {orderInfo.title}
                  </Text>
                </View>
                <View style={[styles.stageIcon, orderInfo.isUrgent && styles.stageIconUrgent]}>
                  <Icon
                    name={orderInfo.isUrgent ? 'arrowUpRight' : orderInfo.icon}
                    size={orderInfo.isUrgent ? 16 : 19}
                    color="#FFFFFF"
                    strokeWidth={orderInfo.isUrgent ? 2.4 : 2}
                  />
                </View>
              </View>

              {/* Segmented stage progress line matching 5-step journey */}
              <View style={styles.track} accessibilityElementsHidden>
                {orderSteps.map((st, i) => (
                  <View
                    key={st.key}
                    style={[
                      styles.seg,
                      i === orderAt && styles.segNow,
                      {
                        backgroundColor:
                          i < orderAt ? colors.orange : i === orderAt ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                      },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          </View>
        ) : active.leadId ? (
          /* Legacy order fallback */
          <View style={[styles.orderBody, styles.legacyRow]}>
            <Pressable
              onPress={onActive}
              accessibilityRole="button"
              accessibilityLabel={`${active.count} active orders`}
              hitSlop={8}
              style={webCursor}
            >
              <Text style={[styles.big, { color: a.fg }]}>{active.count}</Text>
              <Text style={[styles.caption, { color: a.soft }]}>{active.count === 1 ? 'Active order' : 'Active orders'}</Text>
            </Pressable>
            <Pressable
              onPress={onActive}
              accessibilityRole="button"
              accessibilityLabel={`${active.leadStatus}. ${active.leadId}`}
              style={[styles.lead, webCursor]}
            >
              <View style={styles.leadTop}>
                <View style={styles.leadText}>
                  <Text style={[styles.personLabel, { color: a.soft }]} numberOfLines={1}>
                    #{active.leadId}
                  </Text>
                  <Text style={[styles.personValue, { color: a.fg }]} numberOfLines={1}>
                    {active.leadStatus}
                  </Text>
                </View>
                <View style={styles.stageIcon}>
                  <Icon name={STAGE_ICON[active.leadArt ?? ''] ?? 'shirt'} size={19} color="#FFFFFF" strokeWidth={2} />
                </View>
              </View>
              <StageTrack stage={active.leadArt} />
            </Pressable>
          </View>
        ) : (
          /* Empty state */
          <Pressable onPress={onActive} style={({ pressed }) => [styles.orderBody, webCursor, pressed && { opacity: 0.94 }]}>
            <View style={styles.emptyRow}>
              <View>
                <Text style={[styles.big, { color: a.fg }]}>0</Text>
                <Text style={[styles.caption, { color: a.soft }]}>Active orders</Text>
              </View>
              <Text style={[styles.personValue, { color: a.soft }]}>Nothing in progress</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* ── Bottom Pair: Campus Drop-off / Pickup & Wallet ── */}
      <View style={styles.pair}>
        {/* White Card: Campus Drop-off or Scheduled Pickup (No false return date promises) */}
        <Tile
          onPress={onNext}
          label={next ? `Pickup scheduled: ${next.when}` : 'Drop-off at campus counter'}
          tone={p}
          style={styles.small}
        >
          <View style={styles.row}>
            <Tag text={next ? 'Pickup' : 'Drop-off'} tone={p} />
            <View style={[styles.goDot, styles.quietDot]}>
              <Icon name={next ? 'truck' : 'mapPin'} size={14} color={colors.inkSoft} strokeWidth={2} />
            </View>
          </View>
          <View>
            <Text style={[styles.midSmall, { color: p.fg }]} numberOfLines={1}>
              {next ? next.when : 'Campus counter'}
            </Text>
            <Text style={[styles.caption, { color: p.soft }]} numberOfLines={1}>
              {next ? next.slot.replace(/:00/g, '') : 'Drop off & collect anytime'}
            </Text>
          </View>
        </Tile>

        {/* Yellow Card: Wallet balance */}
        <Tile onPress={onWallet} label={`Wallet balance ${balance}`} tone={w} style={styles.small}>
          <View style={styles.row}>
            <Tag text="Wallet" tone={w} />
            <View style={[styles.goDot, { backgroundColor: w.dot }]}>
              <Icon name="plus" size={14} color={w.dotFg} strokeWidth={2.4} />
            </View>
          </View>
          <View>
            <Text style={[styles.mid, { color: w.fg }]} numberOfLines={1} adjustsFontSizeToFit>
              {balance}
            </Text>
            <Text style={[styles.caption, { color: w.soft }]} numberOfLines={1}>
              {pending ? `+${pending} pending` : 'Balance'}
            </Text>
          </View>
        </Tile>
      </View>
    </View>
  );
}

function Tile({ onPress, label, tone, style, children }: { onPress: () => void; label: string; tone: Tone; style: object | object[]; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { backgroundColor: tone.bg }, tone.light && styles.lightTile, style, webCursor, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {children}
    </Pressable>
  );
}

const STAGES = ['collecting', 'washing', 'drying', 'ironing', 'packing', 'delivery'];
const STAGE_ICON: Record<string, IconName> = {
  collecting: 'truck',
  washing: 'droplet',
  drying: 'sparkle',
  ironing: 'shirt',
  packing: 'package',
  delivery: 'truck',
};
function StageTrack({ stage }: { stage?: string }) {
  const at = Math.max(0, STAGES.indexOf(stage ?? ''));
  return (
    <View style={styles.track} accessibilityLabel={`Step ${at + 1} of ${STAGES.length}`}>
      {STAGES.map((s, i) => (
        <View key={s} style={[styles.seg, i === at && styles.segNow, { backgroundColor: i < at ? app.yellow : i === at ? '#FFFFFF' : 'rgba(255,255,255,0.2)' }]} />
      ))}
    </View>
  );
}

function Tag({ text, tone }: { text: string; tone: Tone }) {
  return (
    <View style={[styles.tag, { backgroundColor: tone.tagBg }]}>
      {tone.accent ? <View style={[styles.tagDot, { backgroundColor: tone.accent }]} /> : null}
      <Text style={[styles.tagText, { color: tone.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: GAP, marginBottom: space.lg },
  pair: { flexDirection: 'row', gap: GAP },
  tile: { borderRadius: 24, padding: 16, overflow: 'hidden' },
  lightTile: { borderWidth: 1.2, borderColor: '#D4D8E0', ...soft },
  hero: { minHeight: 154, justifyContent: 'space-between', padding: 18, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.18)', ...soft },
  small: { flex: 1, height: 116, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  orderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  orderTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  orderTabText: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.65)' },
  orderTabTextActive: { fontFamily: fonts.semibold, color: '#FFFFFF' },
  orderBody: { marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 11, borderRadius: 13 },
  doneChip: { alignSelf: 'auto', gap: 5, paddingRight: 8 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  big: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  mid: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.7 },
  midSmall: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 21, letterSpacing: -0.3 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16, marginTop: 1 },
  lead: { alignItems: 'flex-end', gap: 9, flexShrink: 1, maxWidth: '68%' },
  leadTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leadText: { flexShrink: 1, alignItems: 'flex-end' },
  stageIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  stageIconUrgent: { backgroundColor: colors.orange, borderRadius: 20 },
  track: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  seg: { width: 14, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  segActive: { backgroundColor: colors.orange },
  segCurrent: { width: 22 },
  segNow: { width: 22 },
  personLabel: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15 },
  personValue: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  goDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quietDot: { backgroundColor: '#F4F2EE' },
  legacyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
