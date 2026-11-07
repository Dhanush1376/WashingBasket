import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { AppScreen } from '../../components/app/AppScreen';
import { ART } from '../../components/app/art';
import { Icon, type IconName } from '../../components/app/Icon';
import { Pop, Rise, useFocusReplay } from '../../components/app/motion';
import { Button } from '../../components/app/primitives';
import { EmptyState, ListSkeleton } from '../../components/app/states';
import { GarmentIcon } from '../../components/laundry/GarmentIcon';
import { get5StepJourney, OrderTimeline } from '../../components/laundry/OrderTimeline';
import { formatCardDate, getOrderTheme, getStatusDot } from '../../components/app/orders';
import { QrCode, QrFrame } from '../../components/laundry/QrCode';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillTextArea } from '../../components/ui/SheetForm';
import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { TONE } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { date, money, plural, when } from '../../lib/format';
import { PAYMENT_COPY, STATUS_COPY } from '../../mock/engine/lifecycle';
import { findLocation, findQr, findReceipt, findStaff, openIssueFor, qrState, walletBalance } from '../../mock/engine/selectors';
import { cancelOrder } from '../../mock/services/orderService';
import { payOrder } from '../../mock/services/paymentService';
import { qrPayload, refreshQr, shortCode } from '../../mock/services/qrService';
import { topUp } from '../../mock/services/walletService';
import type { LaundryOrder, QrToken } from '../../mock/types';
import type { ScreenProps } from '../../navigation/types';
import { app, brand, colors, fonts, space } from '../../theme';
import { invalidate, keys, useQuery } from '../../lib/query';
import { listOffers } from '../../services/mock/account.service';
import type { Offer } from '../../types/models';
import { Ticket, ticketHeight, ticketShadow, ticketTheme } from '../../components/offers/Ticket';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* the Profile and Home palette: warm white page, white cards with a warm edge, beige for icons and inner panels,
   the logo orange for the wallet, navy for the one dark tile */
const BG = '#FAF9F6';
const BEIGE = '#F1EDE4';
const CHIP = '#F4F2EE';
const RULE = '#EFECE6';
const NAVY = '#0A1C3E';
const RADIUS = 26;
const QR_HERO_BG = '#FED843'; // Signature warm orange hero card, consistent across all order steps

const DEFAULT_OFFERS: Offer[] = [
  {
    id: 'of-5',
    code: 'FIRSTWASH',
    discountBadge: '20% OFF',
    badgeLabel: 'Limited Offer',
    title: 'Flat 20% off',
    description: 'On your first laundry pickup or drop-off.',
    validFrom: '2026-10-01',
    validUntil: '2026-12-31',
    eligibility: 'New customers',
    serviceIds: 'all',
    status: 'active',
    discountValue: '20%',
  },
  {
    id: 'of-2',
    code: 'CLEAN15',
    discountBadge: '15% OFF',
    badgeLabel: 'Popular Deal',
    title: '15% off order',
    description: 'Valid on wash, iron, and dry cleaning orders.',
    validFrom: '2026-11-01',
    validUntil: '2026-11-30',
    eligibility: 'All customers',
    serviceIds: ['dry-clean'],
    status: 'active',
    discountValue: '15%',
  },
  {
    id: 'of-1',
    code: 'FREEDEL',
    discountBadge: 'FREE DELIVERY',
    badgeLabel: 'Best Value',
    title: 'Free doorstep pickup & delivery',
    description: 'Zero delivery fee on your laundry.',
    validFrom: '2026-09-01',
    validUntil: '2026-12-31',
    eligibility: 'All customers',
    serviceIds: 'all',
    status: 'active',
    discountValue: 'FREE',
  },
];

/** Re-renders every few seconds so QR expiry countdowns stay true. */
function useNow(ms = 15000) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function expiresIn(q: QrToken | undefined, now: string) {
  if (!q?.expiresAt) return '';
  const mins = Math.round((Date.parse(q.expiresAt) - Date.parse(now)) / 60000);
  if (mins <= 0) return 'Expired';
  if (mins < 60) return `Expires in ${mins} min`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `Expires in ${hours} h` : `Valid until ${date(q.expiresAt)}`;
}

const TICKET_TILTS = ['-5.5deg', '4.5deg', '-4.8deg', '5.2deg', '-4.2deg'];

function AnimatedTicketCard({
  offer,
  index,
  isSelected,
  onPress,
  estSavings,
}: {
  offer: Offer;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  estSavings: number;
}) {
  const theme = ticketTheme(offer, index);
  const tW = 246;
  const tH = ticketHeight(tW);
  const tilt = TICKET_TILTS[index % TICKET_TILTS.length];

  const scale = useSharedValue(isSelected ? 1.04 : 1);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.04 : 1, { damping: 15, stiffness: 220 });
  }, [isSelected, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: tilt }, { scale: scale.value }],
  }));

  return (
    <Pressable
      key={offer.id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.code}, ${offer.title}. ${isSelected ? 'Applied' : 'Tap to apply'}`}
      style={({ pressed }) => [
        styles.ticketItem,
        webCursor,
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Animated.View
        style={[
          ticketShadow,
          isSelected && styles.ticketSelectedShadow,
          {
            marginVertical: 8,
          },
          animatedStyle,
        ]}
      >
        <Ticket
          offer={offer}
          theme={theme}
          no={index + 1}
          w={tW}
          h={tH}
          onRedeem={onPress}
        />

        {/* Top-right floating ribbon badge on selected ticket */}
        {isSelected ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.ticketCornerBadge}>
            <Icon name="check" size={10} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.ticketCornerBadgeText}>APPLIED</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Bottom action pill - fixed height to prevent vertical jitter */}
      <View style={[styles.ticketActionPill, isSelected && styles.ticketActionPillSelected]}>
        {isSelected ? (
          <>
            <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.ticketActionTextSelected}>
              Applied · Saved {money(estSavings)}
            </Text>
          </>
        ) : (
          <Text style={styles.ticketActionText}>
            Tap to apply · <Text style={styles.ticketActionSavingsText}>Saves {money(estSavings)}</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * One laundry order, live: pay and unlock its QR, show it at the counter (or to the pickup partner), follow every
 * step, check the clothes and show the delivery QR. Every change made by staff on another device shows up here.
 * Laid out like Profile and Home: an id card on top, the navy progress tile, then the card for what to do now.
 */
export function LaundryOrderScreen({ navigation, route }: ScreenProps<'LaundryOrder'>) {
  const { orderId } = route.params;
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const now = useNow();
  const replay = useFocusReplay();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payDrawerOpen, setPayDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [showOffersPicker, setShowOffersPicker] = useState(true);
  const receiptOpened = useRef(false);
  const offersQuery = useQuery(keys.offers, listOffers);

  const normalizedId = orderId ? orderId.replace(/^WB(?=\d)/i, 'WB-') : '';
  const order =
    state?.orders.find((o) => (o.id === orderId || o.id === normalizedId) && (!customer || o.customerId === customer.id)) ??
    state?.orders.find((o) => o.id === orderId || o.id === normalizedId);
  const receipt = state && order ? findReceipt(state, order.id) : undefined;

  // the first time the order is accepted, the receipt prints itself
  useEffect(() => {
    if (receipt && !receipt.animationShownAt && !receiptOpened.current && navigation.isFocused()) {
      receiptOpened.current = true;
      navigation.navigate('Receipt', { orderId });
    }
  }, [receipt, navigation, orderId]);

  if (!state || !customer) {
    return (
      <AppScreen title={`Order ${orderId}`} background={BG}>
        <ListSkeleton rows={3} height={140} />
      </AppScreen>
    );
  }
  if (!order) {
    return (
      <AppScreen title={`Order ${orderId}`} background={BG}>
        <Rise replay={0} distance={18} style={styles.page}>
          <View style={styles.notFoundSimple}>
            <View style={styles.notFoundSimpleIcon}>
              <Icon name="bag" size={24} color={NAVY} strokeWidth={2.2} />
            </View>
            <Text style={styles.notFoundSimpleTitle}>Order not found</Text>
            <Text style={styles.notFoundSimpleMessage}>
              We couldn’t find order #{orderId} under your active account.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Main', { screen: 'Orders' })}
              accessibilityRole="button"
              accessibilityLabel="View your orders"
              style={({ pressed }) => [styles.notFoundSimpleBtn, webCursor, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.notFoundSimpleBtnText}>View your orders</Text>
              <Icon name="arrowRight" size={14} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </Rise>
      </AppScreen>
    );
  }

  const location = findLocation(state, order.locationId);
  const status = STATUS_COPY[order.status];
  const isHome = order.serviceMode === 'HOME_PICKUP';
  const balance = walletBalance(state, customer.id);
  const intake = findQr(state, order.intakeQrId);
  const delivery = findQr(state, order.deliveryQrId);
  const deliveryState = qrState(delivery, now);
  const issue = openIssueFor(state, order.id);
  const accepter = order.acceptedBy ? findStaff(state, order.acceptedBy) : undefined;
  const payment = PAYMENT_COPY[order.payment.status];
  const orderIdx = state?.orders ? Math.max(0, state.orders.findIndex((x) => x.id === order.id)) : 0;
  const theme = getOrderTheme(order.status, orderIdx);

  // Available coupons/offers integration

  const availableOffers = (() => {
    const fetched = (offersQuery.data ?? []).filter((o) => o.status === 'active');
    return fetched.length ? fetched : DEFAULT_OFFERS;
  })();

  const discountAmount = (() => {
    if (!appliedOffer || !order) return 0;
    if (appliedOffer.code === 'FIRSTWASH') return Math.round(order.subtotal * 0.2);
    if (appliedOffer.code === 'CLEAN15') return Math.round(order.subtotal * 0.15);
    if (appliedOffer.code === 'FREEDEL') return Math.min(order.serviceCharge || 30, 30);
    if (appliedOffer.discountValue?.includes('%')) {
      const pct = parseInt(appliedOffer.discountValue, 10);
      return Math.round(order.subtotal * (pct / 100));
    }
    return 20;
  })();

  const getOfferDiscount = (offer: Offer) => {
    if (offer.code === 'FIRSTWASH') return Math.round(order.subtotal * 0.2);
    if (offer.code === 'CLEAN15') return Math.round(order.subtotal * 0.15);
    if (offer.code === 'FREEDEL') return Math.min(order.serviceCharge || 30, 30);
    if (offer.discountValue?.includes('%')) {
      const pct = parseInt(offer.discountValue, 10);
      return Math.round(order.subtotal * (pct / 100));
    }
    return 20;
  };

  const toggleOffer = (offer: Offer) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (appliedOffer?.id === offer.id) {
      haptic.tap();
      setAppliedOffer(null);
    } else {
      haptic.success();
      setAppliedOffer(offer);
    }
  };

  const payableTotal = Math.max(0, order.total - discountAmount);
  const short = Math.max(0, payableTotal - balance);

  const handleTopUp = async (amount: number) => {
    if (!customer) return;
    setToppingUp(true);
    setPayError(null);
    try {
      await topUp(customer.id, amount, 0, 0);
      invalidate(keys.wallet, keys.profileWallet);
      haptic.success();
    } catch (e) {
      haptic.error();
      setPayError(e instanceof Error ? e.message : 'Top-up failed. Please try again.');
    } finally {
      setToppingUp(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const r = await payOrder(
        order.id,
        customer.id,
        appliedOffer ? { code: appliedOffer.code ?? 'OFFER', discount: discountAmount } : undefined
      );
      if (r.ok) {
        haptic.success();
        setPayDrawerOpen(false);
      }
      else {
        haptic.error();
        setPayError(`Your wallet balance is ${money(r.balance)}, ${money(r.shortfall)} short. Nothing was charged.`);
      }
    } catch (e) {
      haptic.error();
      setPayError(e instanceof Error ? e.message : 'Payment didn’t go through. Try again.');
    } finally {
      setPaying(false);
    }
  };

  const refresh = async (purpose: 'INTAKE' | 'DELIVERY') => {
    setRefreshing(true);
    try {
      await refreshQr(order.id, customer.id, purpose);
      haptic.success();
    } catch {
      haptic.error();
    } finally {
      setRefreshing(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      await cancelOrder(order.id, customer.id, cancelReason);
      haptic.success();
      setCancelOpen(false);
    } catch {
      haptic.error();
    } finally {
      setCancelling(false);
    }
  };

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  /** A QR in a white card: clean aligned header, dashed perforation line, code well, dashed line, and code controls. */
  const qrCard = (q: QrToken, opts: { title: string; message: string; purpose: 'INTAKE' | 'DELIVERY'; locked?: boolean }) => {
    const expired = !opts.locked && qrState(q, now) === 'EXPIRED';
    return (
      <View style={[styles.card, styles.qrCard, { backgroundColor: QR_HERO_BG, borderColor: 'transparent' }]}>
        {/* Clean, minimal header: Title with live dot on left, compact Refresh on right */}
        <View style={styles.qrHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {opts.locked ? (
              <Icon name="lock" size={14} color={brand.orange} strokeWidth={2.4} />
            ) : (
              <View style={[styles.qrLiveDot, expired && { backgroundColor: colors.danger }]} />
            )}
            <Text style={[styles.qrTitle, { color: '#0A1C3E' }]}>{opts.title}</Text>
          </View>

          {!opts.locked ? (
            <Pressable
              onPress={() => refresh(opts.purpose)}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel="Get a fresh QR code"
              hitSlop={8}
              style={({ pressed }) => [styles.headerRefreshBtn, webCursor, pressed && { opacity: 0.7 }]}
            >
              <Icon name="refresh" size={12} color="#0A1C3E" strokeWidth={2.2} />
              <Text style={styles.headerRefreshText}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
            </Pressable>
          ) : (
            <View style={styles.qrStatusPillLocked}>
              <Text style={styles.qrStatusPillLabelLocked}>Locked</Text>
            </View>
          )}
        </View>

        {/* 1-line clean subtitle across full width */}
        <Text style={[styles.qrSubtitle, { color: '#0A1C3E', marginTop: 4 }]} numberOfLines={1}>
          {expired ? 'This code has expired · Tap Refresh' : opts.message}
        </Text>

        {/* Dashed perforation line */}
        <View style={styles.ticketDashed} />

        {/* QR Code well */}
        <View style={styles.qrWellThemed}>
          <QrFrame
            value={qrPayload(q)}
            locked={!!opts.locked || expired}
            size={184}
            label={opts.locked ? 'QR code, locked until payment' : expired ? 'QR code, expired' : `QR code for order ${order.id}`}
          />
        </View>

        {!opts.locked ? (
          <>
            <View style={styles.ticketDashed} />
            <Pressable
              onPress={() => copy(shortCode(q.token))}
              accessibilityRole="button"
              accessibilityLabel={`Code ${shortCode(q.token)}. Copy`}
              style={({ pressed }) => [styles.codePillThemed, webCursor, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.codeText}>{shortCode(q.token)}</Text>
              <View style={styles.codeCopyThemed}>
                <Icon name={copied ? 'check' : 'copy'} size={13} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </Pressable>
            <Text style={[styles.qrLimits, { color: 'rgba(10, 28, 62, 0.72)' }]}>
              {expired ? 'This code has expired.' : `${expiresIn(q, now)} · single use`}
            </Text>

          </>
        ) : null}
      </View>
    );
  };

  /* ─────────── the card for what to do now, by state ─────────── */
  /* ── the card for what to do now, by state ── */
  let hero: React.ReactNode = null;
  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';
  const isRejected = order.status === 'REJECTED';
  const isDeliveryStage = order.status === 'READY_FOR_DELIVERY' || order.status === 'AWAITING_CUSTOMER_VERIFICATION';

  // Resolved active QR token for the order
  const baseQr = (isDeliveryStage ? delivery : null) || delivery || intake;
  const activeQr: QrToken = baseQr
    ? {
        ...baseQr,
        purpose: isDeliveryStage ? 'CUSTOMER_DELIVERY_VERIFICATION' : baseQr.purpose,
      }
    : {
        id: `qr-${order.id}`,
        token: order.id.replace(/[^A-Z0-9]/gi, '').padEnd(10, '0').slice(0, 10),
        orderId: order.id,
        locationId: order.locationId,
        purpose: isDeliveryStage ? 'CUSTOMER_DELIVERY_VERIFICATION' : (isHome ? 'PICKUP_COLLECTION' : 'ORDER_SUBMISSION'),
        status: order.status === 'PAYMENT_PENDING' ? 'LOCKED' : 'ACTIVE',
        createdAt: order.createdAt,
        ttlMinutes: 1440,
        scans: [],
        activatedAt: order.createdAt,
        expiresAt: new Date(Date.parse(now) + 86400000).toISOString(),
      };

  if (isDelivered) {
    hero = (
      <View style={styles.deliveredWrap}>
        {/* Delivery confirmation card */}
        <View style={[styles.deliveredConfirmCard, { backgroundColor: theme.bg }]}>
          <View style={styles.deliveredConfirmIcon}>
            <Icon name="check" size={20} color="#0D7A21" strokeWidth={2.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveredConfirmTitle}>Delivered</Text>
          </View>
        </View>

        {/* Home-style booking banner for new order */}
        <Pressable
          onPress={() => navigation.navigate('Main', { screen: 'Book' })}
          accessibilityRole="button"
          accessibilityLabel="Start a new order. Fresh clothes at your door."
          style={({ pressed }) => [
            styles.bookingHeroCard,
            webCursor,
            pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
          ]}
        >
          <View style={styles.bookingHeroHalo} />
          <Image
            source={ART.steam}
            style={styles.bookingHeroArt}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.bookingHeroBody}>
            <View style={styles.bookingHeroKicker}>
              <View style={styles.bookingHeroDot} />
              <Text style={styles.bookingHeroKickerText}>New order</Text>
            </View>
            <Text style={styles.bookingHeroTitle}>{"Fresh clothes,\nat your door"}</Text>
            <View style={styles.bookingHeroCta}>
              <Text style={styles.bookingHeroCtaText}>Start a new order</Text>
              <Icon name="arrowRight" size={14} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </View>
        </Pressable>
      </View>
    );
  } else if (isCancelled) {
    hero = (
      <StateCard
        icon="x"
        tint={CHIP}
        tone={colors.inkSoft}
        title="Cancelled"
        themeBg={theme.bg}
      />
    );
  } else if (isRejected) {
    hero = (
      <StateCard
        icon="x"
        tint={colors.dangerTint}
        tone={colors.danger}
        title="Rejected"
        themeBg={theme.bg}
      >
        <Button label="Start a new order" variant="outline" onPress={() => navigation.navigate('Main', { screen: 'Book' })} style={{ marginTop: space.lg }} />
      </StateCard>
    );
  } else if (issue) {
    hero = (
      <StateCard icon="alert" tint={colors.dangerTint} tone={colors.danger} title="Issue reported">
        <Text style={styles.stateText}>{issue.mismatches.length ? issue.mismatches.map((m) => `${m.name}: received ${m.received} of ${m.expected}`).join(' · ') : issue.note}</Text>
        {issue.mismatches.length && issue.note ? <Text style={styles.quote}>"{issue.note}"</Text> : null}
        <Text style={styles.stateFine}>Reported {when(issue.reportedAt)}. Our team is looking into it; the order stays open until it’s sorted.</Text>
      </StateCard>
    );
  } else if (order.status === 'PAYMENT_PENDING') {
    hero = (
      <View style={[styles.card, styles.lockedHeroCard, { backgroundColor: QR_HERO_BG, borderColor: 'transparent' }]}>
        {/* Perfectly aligned header */}
        <View style={styles.qrHeaderRow}>
          <Text style={styles.qrTitle}>{isHome ? 'Pickup QR' : 'Drop-off QR'}</Text>
          <View style={styles.qrStatusPillLocked}>
            <Icon name="lock" size={11} color={brand.orange} strokeWidth={2.4} />
            <Text style={styles.qrStatusPillLabelLocked}>Locked</Text>
          </View>
        </View>

        {/* Concise 1-line subtitle with strong high-contrast color */}
        <Text style={[styles.qrSubtitle, { color: '#0A1C3E' }]}>
          {isHome ? 'Pay to unlock your pickup QR code' : 'Pay to unlock your drop-off QR code'}
        </Text>

        {/* Dashed perforation line */}
        <View style={styles.ticketDashed} />

        {/* QR well with locked pattern */}
        <Pressable
          onPress={() => setPayDrawerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Locked QR code. Pay ${money(payableTotal)} to unlock.`}
          style={({ pressed }) => [styles.lockedQrWell, webCursor, pressed && { opacity: 0.94 }]}
        >
          <QrFrame value={qrPayload(activeQr)} locked size={180} label="QR code, locked until payment" />
        </Pressable>

        {/* Dashed perforation line */}
        <View style={styles.ticketDashed} />

        {/* Bottom row: Amount due on left, Pay button on right */}
        <View style={styles.lockedHeroBottom}>
          <View style={styles.lockedHeroAmountCol}>
            <Text style={styles.lockedHeroAmountLabel}>To pay</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.lockedHeroAmount}>{money(payableTotal)}</Text>
              {appliedOffer ? (
                <Text style={styles.lockedHeroOriginalAmount}>{money(order.total)}</Text>
              ) : null}
            </View>
            <Text style={styles.lockedHeroPieces}>
              {plural(order.pieces, 'piece')}{appliedOffer ? ` · Save ${money(discountAmount)}` : ''}
            </Text>
          </View>

          <Pressable
            onPress={() => setPayDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Pay ${money(payableTotal)} to unlock QR code`}
            style={({ pressed }) => [styles.lockedHeroPayBtn, webCursor, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Icon name="lock" size={13} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.lockedHeroPayText}>Pay {money(payableTotal)}</Text>
            <Icon name="arrowUpRight" size={14} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
    );
  } else {
    // For all active states until delivered (AWAITING_STAFF_ACCEPTANCE, ACCEPTED, PICKUP_CONFIRMED, PROCESSING, READY_FOR_DELIVERY, AWAITING_CUSTOMER_VERIFICATION):
    const qrPurpose = isDeliveryStage ? 'DELIVERY' : 'INTAKE';
    const qrTitle = isDeliveryStage
      ? (isHome ? 'Delivery QR' : 'Collection QR')
      : (isHome ? 'Pickup QR' : 'Drop-off QR');
    const qrMessage = isDeliveryStage
      ? (isHome ? 'Show to delivery partner to receive clothes' : 'Show at counter to collect clothes')
      : order.status === 'ACCEPTED'
        ? 'Clothes accepted · Show code at counter if needed'
        : order.status === 'PROCESSING'
          ? 'Clothes in process · Keep code ready'
          : (isHome ? 'Show to pickup partner on arrival' : 'Show at counter to drop off clothes');

    hero = (
      <Pop key={`qr-stage-${order.status}`} from={0.96}>
        <View style={{ gap: space.md }}>
          {qrCard(activeQr, {
            title: qrTitle,
            message: qrMessage,
            purpose: qrPurpose,
          })}

        </View>
      </Pop>
    );
  }

  const isPaid = order.payment.status === 'COMPLETED' || !!order.payment.paidAt;
  const canCancel = !isPaid && order.status === 'PAYMENT_PENDING';
  const stopped = order.status === 'REJECTED' || order.status === 'CANCELLED';
  const progress = get5StepJourney(order, state);

  return (
    <AppScreen title={`Order ${order.id}`} subtitle="Order details" leading="back" background={BG}>
      <View style={styles.page}>
        {/* ── Prominent Order Status Heading ── */}
        <Rise replay={replay} delay={50} distance={14} scale={0.98}>
          <View style={styles.orderStatusHead}>
            <View style={styles.orderStatusHeaderRow}>
              <Text style={styles.orderStatusTitle}>Order details</Text>
            </View>
            <Text style={styles.orderStatusMeta}>
              {date(order.createdAt)} · {isHome ? 'Home pickup' : 'Campus counter'}
            </Text>
            <View style={styles.headDashedLine} />
          </View>
        </Rise>

        {/* ── what to do now: QR Code or Status Hero ── */}
        <Rise replay={replay} delay={110} distance={18} scale={0.97}>
          {hero}
        </Rise>

        {receipt ? (
          <Rise replay={replay} delay={190} distance={18} scale={0.97}>
            <Pressable
              onPress={() => navigation.navigate('Receipt', { orderId: order.id })}
              accessibilityRole="button"
              accessibilityLabel={`Receipt ${receipt.number}`}
              style={({ pressed }) => [styles.card, styles.linkCard, webCursor, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={[styles.bubble, styles.bubbleLg, { backgroundColor: app.yellow }]}>
                <Icon name="receipt" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.linkTitle}>Receipt {receipt.number}</Text>
                <Text style={styles.linkSub}>Issued {when(receipt.issuedAt)}</Text>
              </View>
              <View style={styles.arrowLight}>
                <Icon name="arrowUpRight" size={16} color={colors.ink} strokeWidth={2} />
              </View>
            </Pressable>
          </Rise>
        ) : null}

        {/* ── the journey ── */}
        <Rise replay={replay} delay={230} distance={18} scale={0.97}>
          <View style={[styles.card, styles.section]}>
            <SectionHead title="Progress" right={<Tag label={progress.label} />} />
            <OrderTimeline order={order} state={state} />
          </View>
        </Rise>

        {/* ── the basket ── */}
        <Rise replay={replay} delay={270} distance={18} scale={0.97}>
          <View style={[styles.card, styles.section]}>
            <SectionHead title="Items" right={<Tag label={plural(order.pieces, 'piece')} />} />
            {order.lines.map((l, i) => (
              <View key={l.itemId} style={[styles.line, i > 0 && styles.lineRule]}>
                <GarmentIcon name={l.icon} size={38} />
                <View style={styles.flex}>
                  <Text style={styles.lineName}>{l.name}</Text>
                  <Text style={styles.lineMeta}>
                    {l.categoryName} · {l.qty} × {money(l.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.lineAmount}>{money(l.amount)}</Text>
              </View>
            ))}
            <View style={styles.totals}>
              <TotalLine label="Subtotal" value={money(order.subtotal)} />
              <TotalLine label={isHome ? 'Pickup & delivery' : 'Service charge'} value={order.serviceCharge ? money(order.serviceCharge) : 'Free'} />
              <View style={styles.totalsRule} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{money(order.total)}</Text>
              </View>
            </View>
            {order.instructions ? <Text style={styles.instructions}>Instructions: {order.instructions}</Text> : null}
          </View>
        </Rise>

        {/* ── details: rows like Profile's account card ── */}
        <Rise replay={replay} delay={310} distance={18} scale={0.97}>
          <View style={[styles.card, styles.menuCard]}>
            {order.pickup ? (
              <>
                <InfoRow icon="calendar" label="Pickup" value={`${date(`${order.pickup.date}T00:00:00`)} · ${order.pickup.slotLabel}`} />
                <InfoRow divider icon="home" label="Address" value={`${order.pickup.address}${order.pickup.landmark ? ` · ${order.pickup.landmark}` : ''}`} />
                <InfoRow divider icon="phone" label="Contact" value={order.pickup.contactPhone} />
              </>
            ) : location ? (
              <InfoRow icon="mapPin" label="Drop-off location" value={location.shortName ? `${location.shortName} Campus · ${location.office.address.replace(", LPU Campus", "")}` : location.office.address} />
            ) : null}
            <InfoRow divider icon="wallet" label="Payment" value={`${money(order.payment.amount)} · Wallet`} right={<Tag label={payment.label} dot={isPaid ? "#10B981" : "#D97706"} bg={isPaid ? "rgba(16, 185, 129, 0.14)" : "rgba(254, 216, 67, 0.28)"} color={isPaid ? "#065F46" : "#92400E"} />} />
            {order.payment.txnId ? <InfoRow divider icon="receipt" label="Transaction" value={`${order.payment.txnId}${order.payment.paidAt ? ` · ${when(order.payment.paidAt)}` : ''}`} /> : null}
            {order.payment.reversalTxnId ? <InfoRow divider icon="refresh" label="Refund" value={`${order.payment.reversalTxnId}${order.payment.reversedAt ? ` · ${when(order.payment.reversedAt)}` : ''}`} /> : null}
            {order.payment.failedAttempts ? <InfoRow divider icon="alert" label="Failed attempts" value={String(order.payment.failedAttempts)} /> : null}
          </View>
        </Rise>

        {/* ── help: the beige card, like Profile's calendar ── */}
        {location ? (
          <Rise replay={replay} delay={350} distance={18} scale={0.97}>
            <View style={styles.helpCard}>
              <Pressable
                onPress={() => navigation.navigate('Support')}
                accessibilityRole="button"
                accessibilityLabel="Help and support"
                style={({ pressed }) => [styles.helpRow, webCursor, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.bubble, styles.bubbleLg, styles.helpBubble]}>
                  <Icon name="headset" size={19} color={colors.ink} strokeWidth={2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Need a hand?</Text>
                  <Text style={styles.linkSub} numberOfLines={1}>
                    Campus desk · 8 AM – 9 PM
                  </Text>
                </View>
                <View style={styles.arrowDark}>
                  <Icon name="arrowUpRight" size={15} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </Pressable>
              {canCancel ? (
                <Pressable
                  onPress={() => setCancelOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel this order"
                  style={({ pressed }) => [styles.cancelRow, webCursor, pressed && { opacity: 0.75 }]}
                >
                  <Icon name="x" size={14} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={styles.cancelText}>Cancel this order</Text>
                </Pressable>
              ) : null}
            </View>
          </Rise>
        ) : null}
      </View>

      {/* ── pay & unlock QR drawer: clean bill breakdown ── */}
      <BottomSheet
        visible={payDrawerOpen && order.status === 'PAYMENT_PENDING'}
        onClose={() => setPayDrawerOpen(false)}
        footer={
          <View style={styles.payFooterWrap}>
            <Pressable
              onPress={pay}
              disabled={!!short || paying}
              accessibilityRole="button"
              accessibilityLabel={`Pay ${money(payableTotal)}`}
              style={({ pressed }) => [
                styles.paySubmitBtn,
                !!short && { opacity: 0.45 },
                webCursor,
                pressed && !short && !paying && { opacity: 0.9, transform: [{ scale: 0.985 }] },
              ]}
            >
              <Icon name="lock" size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.paySubmitText}>
                {paying ? 'Processing payment...' : `Pay ${money(payableTotal)} & Unlock QR`}
              </Text>
            </Pressable>
            <Text style={styles.paySubmitSub}>
              1-tap wallet payment · Drop-off QR unlocks immediately upon payment
            </Text>
          </View>
        }
      >
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Bill & Payment</Text>
            <Text style={styles.sheetSubtitle}>Order #{order.id}</Text>
          </View>
          <Pressable
            onPress={() => setPayDrawerOpen(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close drawer"
            style={({ pressed }) => [styles.sheetCloseBtn, webCursor, pressed && { opacity: 0.7 }]}
          >
            <Icon name="x" size={16} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={[styles.stack, { marginTop: space.sm }]}>
          {/* ── Offers & Coupons Card with Original Scrollable Tickets (On Top) ── */}
          <View style={styles.offerCard}>
            <View style={styles.offerCardHead}>
              <View style={styles.offerCardTitleRow}>
                <View style={[styles.offerIconCircle, appliedOffer && styles.appliedIconCircle]}>
                  <Icon name="tag" size={15} color={appliedOffer ? '#059669' : colors.orange} strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={styles.offerSelectTitle} numberOfLines={1}>
                    {appliedOffer ? `${appliedOffer.code} Applied` : 'Coupons & Offers'}
                  </Text>
                  <Text style={styles.offerSelectSub} numberOfLines={1}>
                    {appliedOffer
                      ? `Saving ${money(discountAmount)} on this order`
                      : 'Scroll & tap any coupon card to apply'}
                  </Text>
                </View>
              </View>

              {appliedOffer ? (
                <Pressable
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    haptic.tap();
                    setAppliedOffer(null);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove applied coupon"
                  style={({ pressed }) => [styles.removeCouponBtn, webCursor, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.removeCouponText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Horizontal Scrollable Original Coupon Tickets with Smooth Spring Animation */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ticketCarouselContent}
              style={styles.ticketCarouselScroll}
            >
              {availableOffers.map((offer, i) => (
                <AnimatedTicketCard
                  key={offer.id}
                  offer={offer}
                  index={i}
                  isSelected={appliedOffer?.id === offer.id}
                  onPress={() => toggleOffer(offer)}
                  estSavings={getOfferDiscount(offer)}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── The Bill Receipt Card (Price Details) ── */}
          <View style={styles.billCard}>
            {/* Bill Header */}
            <View style={styles.billTopRow}>
              <View style={styles.billBadge}>
                <View style={styles.billBadgeDot} />
                <Text style={styles.billBadgeText}>
                  {isHome ? 'Doorstep pickup' : 'Campus counter drop-off'}
                </Text>
              </View>
              <Text style={styles.billPieces}>{plural(order.pieces, 'piece')}</Text>
            </View>

            {/* Itemized Garments List */}
            {order.lines.map((l, i) => (
              <View key={l.itemId} style={[styles.billLine, i > 0 && styles.billLineRule]}>
                <View style={styles.billLineIcon}>
                  <GarmentIcon name={l.icon} size={16} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.billLineName}>{l.name}</Text>
                  <Text style={styles.billLineMeta}>
                    {l.qty} × {money(l.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.billLineAmount}>{money(l.amount)}</Text>
              </View>
            ))}

            {/* Ticket Dashed Perforation Line */}
            <View style={styles.billDashed} />

            {/* Summary Lines */}
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>Subtotal</Text>
              <Text style={styles.billRowValue}>{money(order.subtotal)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billRowLabel}>
                {isHome ? 'Pickup & delivery' : 'Service charge'}
              </Text>
              <Text style={styles.billRowValue}>
                {order.serviceCharge ? money(order.serviceCharge) : 'Free'}
              </Text>
            </View>

            {/* Discount row - always present so billCard height never jumps or drops */}
            <View style={styles.billRow}>
              {appliedOffer ? (
                <View style={styles.appliedOfferBadge}>
                  <Icon name="tag" size={11} color="#059669" strokeWidth={2.4} />
                  <Text style={styles.appliedOfferBadgeText}>{appliedOffer.code}</Text>
                </View>
              ) : (
                <Text style={styles.billRowLabel}>Coupon discount</Text>
              )}
              <Text style={appliedOffer ? styles.appliedDiscountText : styles.billRowValueMuted}>
                {appliedOffer ? `-${money(discountAmount)}` : 'None applied'}
              </Text>
            </View>

            {/* Solid separator */}
            <View style={styles.billSolidLine} />

            {/* Total Row - side-by-side strikethrough price keeps row height identical */}
            <View style={styles.billTotalRow}>
              <View>
                <Text style={styles.billTotalLabel}>Total to pay</Text>
                <Text style={styles.billTotalSub}>Includes all taxes</Text>
              </View>
              <View style={styles.billTotalAmountRow}>
                {appliedOffer ? (
                  <Text style={styles.billOriginalTotal}>{money(order.total)}</Text>
                ) : null}
                <Text style={styles.billTotalAmount}>{money(payableTotal)}</Text>
              </View>
            </View>
          </View>

          {/* ── Payment Method / Wallet Source Card ── */}
          <View style={[styles.paySourceCard, !!short && styles.paySourceCardShort]}>
            <View style={styles.paySourceTopRow}>
              <View style={styles.paySourceIcon}>
                <Icon name="wallet" size={19} color={brand.orange} strokeWidth={2.2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.paySourceTitle}>Washing Basket Wallet</Text>
                <Text style={styles.paySourceBalance}>
                  Available balance: {money(balance)}
                </Text>
              </View>
              {short ? (
                <Pressable
                  onPress={() => handleTopUp(Math.max(short, 500))}
                  disabled={toppingUp}
                  accessibilityRole="button"
                  accessibilityLabel={`Top up ${money(Math.max(short, 500))}`}
                  style={({ pressed }) => [styles.payTopUpBtn, webCursor, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                >
                  <Icon name="plus" size={12} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.payTopUpBtnText}>
                    {toppingUp ? 'Adding…' : `Top up ${money(Math.max(short, 500))}`}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.payRadioSelected}>
                  <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </View>

            {/* In-drawer quick top-up options when insufficient */}
            {short ? (
              <View style={styles.inlineTopUpArea}>
                <View style={styles.inlineTopUpAlert}>
                  <Icon name="alert" size={12} color="#D97706" strokeWidth={2.4} />
                  <Text style={styles.inlineTopUpAlertText}>{money(short)} short for this order</Text>
                </View>
                <View style={styles.inlineTopUpChips}>
                  <Pressable
                    onPress={() => handleTopUp(short)}
                    disabled={toppingUp}
                    style={({ pressed }) => [styles.inlineTopUpChip, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.inlineTopUpChipText}>+{money(short)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleTopUp(500)}
                    disabled={toppingUp}
                    style={({ pressed }) => [styles.inlineTopUpChip, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.inlineTopUpChipText}>+₹500</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleTopUp(1000)}
                    disabled={toppingUp}
                    style={({ pressed }) => [styles.inlineTopUpChip, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.inlineTopUpChipText}>+₹1,000</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={cancelOpen} onClose={() => setCancelOpen(false)}>
        <Text style={styles.sheetTitle}>Cancel {order.id}?</Text>
        <Text style={[styles.stateText, { marginTop: space.sm }]}>
          Nothing has been charged. Your order and QR code will be cancelled.
        </Text>
        <View style={{ marginTop: space.lg }}>
          <PillTextArea value={cancelReason} onChangeText={setCancelReason} placeholder="Reason (optional)" accessibilityLabel="Reason for cancelling" />
        </View>
        <View style={[styles.payButtons, { marginTop: space.lg }]}>
          <Button label="Keep order" variant="outline" onPress={() => setCancelOpen(false)} style={styles.flex} />
          <Button label="Cancel order" variant="dark" onPress={cancel} loading={cancelling} style={[styles.flex, { backgroundColor: brand.red, borderColor: brand.red }]} />
        </View>
      </BottomSheet>
    </AppScreen>
  );
}

/* ───────────── pieces ───────────── */

/** A soft pill with an optional coloured dot, as on Home's tiles. */
function Tag({ label, dot, bg = CHIP, color = colors.ink }: { label: string; dot?: string; bg?: string; color?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.tagText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}



/** A white card for a state, with a tinted icon, a small kicker and the title. */
function StateCard({ icon, tint, tone, kicker, title, themeBg, children }: { icon: IconName; tint: string; tone: string; kicker?: string; title: string; themeBg?: string; children?: React.ReactNode }) {
  return (
    <View style={[styles.card, styles.section, themeBg ? { backgroundColor: themeBg, borderColor: 'transparent' } : null]}>
      <View style={[styles.stateHead, !children && { marginBottom: 0 }]}>
        <View style={[styles.bubble, styles.bubbleLg, { backgroundColor: themeBg ? '#FFFFFF' : tint }]}>
          <Icon name={icon} size={20} color={themeBg ? '#0A1C3E' : tone} strokeWidth={2.4} />
        </View>
        <View style={styles.flex}>
          {kicker ? <Text style={[styles.stateKicker, { color: themeBg ? 'rgba(10, 28, 62, 0.72)' : tone }]}>{kicker}</Text> : null}
          <Text style={[styles.stateTitle, themeBg ? { color: '#0A1C3E' } : null, !kicker && { marginTop: 0 }]}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalLine}>
      <Text style={styles.totalLineLabel}>{label}</Text>
      <Text style={styles.totalLineValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, right, divider }: { icon: IconName; label: string; value: string; right?: React.ReactNode; divider?: boolean }) {
  return (
    <View style={[styles.infoRow, divider && styles.infoRule]}>
      <View style={styles.bubble}>
        <Icon name={icon} size={16} color={colors.ink} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {right}
    </View>
  );
}

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 2px 4px rgba(10, 28, 62, 0.03), 0 8px 20px rgba(10, 28, 62, 0.06)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 };

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  orderStatusHead: { paddingHorizontal: 2, paddingTop: space.sm, paddingBottom: 2 },
  orderStatusTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: colors.ink },
  orderStatusMeta: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 3 },
  headDashedLine: {
    width: '100%',
    height: 0,
    borderTopWidth: 2,
    borderColor: '#9E988D',
    borderStyle: 'dashed',
    marginTop: space.md,
    marginBottom: 4,
  },
  flex: { flex: 1 },
  stack: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },

  // every white card: Profile's radius, soft shadow and warm edge
  card: { backgroundColor: '#FFFFFF', borderRadius: RADIUS, borderWidth: 1.2, borderColor: '#EAE6DF', ...soft },
  section: { padding: space.lg },

  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 26, paddingHorizontal: 11, borderRadius: 13, maxWidth: '100%' },
  tagText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: -0.1, color: colors.ink },
  dot: { width: 6, height: 6, borderRadius: 3 },



  // QR card & ticket styling
  qrCard: { padding: space.lg },
  qrHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#0D7A21' },
  headerRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(10, 28, 62, 0.08)' },
  headerRefreshText: { fontFamily: fonts.semibold, fontSize: 12, color: '#0A1C3E', letterSpacing: -0.1 },
  qrTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  qrSubtitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#0A1C3E', marginTop: 4 },
  ticketDashed: { width: '100%', height: 1, borderTopWidth: 1.5, borderColor: 'rgba(10, 28, 62, 0.18)', borderStyle: 'dashed', marginVertical: space.md },
  qrStatusPillLocked: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#FFF2E5', borderWidth: 1, borderColor: 'rgba(254, 135, 1, 0.25)' },
  qrStatusPillLabelLocked: { fontFamily: fonts.semibold, fontSize: 11.5, color: brand.orange },
  qrStatusPillReady: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#E8F8EE', borderWidth: 1, borderColor: 'rgba(13, 122, 33, 0.2)' },
  qrStatusDotReady: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  qrStatusPillLabelReady: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#0D7A21' },
  qrWell: { alignItems: 'center', paddingVertical: space.md, borderRadius: 22, backgroundColor: BEIGE },
  codePill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'center', marginTop: space.lg, height: 40, paddingLeft: space.lg, paddingRight: 6, borderRadius: 20, backgroundColor: CHIP },
  codeText: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 2, color: colors.ink, fontVariant: ['tabular-nums'] },
  codeCopy: { width: 28, height: 28, borderRadius: 14, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  qrLimits: { fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(10, 28, 62, 0.85)', textAlign: 'center', marginTop: space.sm },
  softLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', marginTop: space.md, height: 30, paddingHorizontal: 13, borderRadius: 15, backgroundColor: CHIP },
  softLinkText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },

  // pay pair
  tile: { flex: 1, minHeight: 132, padding: space.lg, justifyContent: 'space-between', borderRadius: RADIUS, borderWidth: 1.2, borderColor: '#EAE6DF', ...soft },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  walletTile: { backgroundColor: '#FFA742' },
  tileAmount: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.9, color: colors.ink, fontVariant: ['tabular-nums'] },
  tileCaption: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft, marginTop: 1 },
  walletCaption: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(10, 28, 62, 0.72)', marginTop: 1 },
  arrowDark: { width: 32, height: 32, borderRadius: 16, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  arrowLight: { width: 32, height: 32, borderRadius: 16, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3D9B5' },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  noticeText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkSoft, marginTop: 2 },
  payButtons: { flexDirection: 'row', gap: space.sm },
  fine: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted, textAlign: 'center' },

  bubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5EFE6', alignItems: 'center', justifyContent: 'center' },
  bubbleLg: { width: 44, height: 44, borderRadius: 22 },

  // state cards
  stateHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stateKicker: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: -0.1 },
  stateTitle: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 23, letterSpacing: -0.4, color: colors.ink, marginTop: 1 },
  stateText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  stateFine: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted, marginTop: space.sm },
  quote: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginTop: space.xs },
  refundChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space.md, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 13, backgroundColor: colors.successTint, maxWidth: '100%' },
  refundText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#0D7A21', flexShrink: 1 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space.md, height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: CHIP, maxWidth: '100%' },
  personText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, flexShrink: 1 },

  // receipt
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  linkTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  linkSub: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.inkMuted, marginTop: 2 },

  // sections
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.4, color: '#0A1C3E' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lineRule: { borderTopWidth: 1, borderTopColor: RULE },
  lineName: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  lineMeta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  lineAmount: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  totals: { marginTop: space.sm, padding: space.md, borderRadius: 18, backgroundColor: BEIGE, gap: 6 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLineLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft },
  totalLineValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  totalsRule: { height: 1, backgroundColor: '#E3DDD0', marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.6, color: colors.ink, fontVariant: ['tabular-nums'] },
  instructions: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: space.md },

  // details
  menuCard: { paddingVertical: space.xs, paddingHorizontal: space.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  infoRule: { borderTopWidth: 1, borderTopColor: '#F0EFEA' },
  infoLabel: { fontFamily: fonts.medium, fontSize: 11.5, letterSpacing: 0.3, color: colors.inkMuted },
  infoValue: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 2 },

  // help
  helpCard: {
    borderRadius: RADIUS,
    backgroundColor: '#FFFFFF',
    padding: space.lg,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    ...soft,
  },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  helpBubble: { backgroundColor: '#F5EFE6' },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: space.md,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F87C87',
  },
  cancelText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  sheetTitle: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CHIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#EAE6DF',
    padding: space.lg,
    ...soft,
  },
  lockedQrWell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: 24,
    backgroundColor: '#F6F2EB',
  },
  lockedHeroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.xs,
    gap: space.md,
  },
  lockedHeroAmountCol: {
    gap: 1,
  },
  lockedHeroAmountLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: 'rgba(10, 28, 62, 0.78)',
  },
  lockedHeroAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  lockedHeroPieces: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(10, 28, 62, 0.78)',
  },
  lockedHeroPayBtn: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0A1C3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  lockedHeroPayText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  notFoundSimple: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    paddingHorizontal: space.xl,
    paddingVertical: 32,
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    ...soft,
  },
  notFoundSimpleIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1EDE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  notFoundSimpleTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  notFoundSimpleMessage: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 19,
    marginBottom: space.sm,
  },
  notFoundSimpleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 22,
    borderRadius: 21,
    backgroundColor: NAVY,
  },
  notFoundSimpleBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: '#FFFFFF',
  },

  // Order Not Found State
  notFoundHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    paddingHorizontal: space.xl,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    marginTop: space.sm,
    ...soft,
  },
  notFoundBadgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundBadgeOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F6F3EC',
    borderWidth: 1.5,
    borderColor: '#EAE5D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    position: 'relative',
  },
  notFoundBadgeInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A1C3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  notFoundBadgeDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D97706',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    marginBottom: 10,
  },
  notFoundChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  notFoundChipId: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  notFoundChipSep: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  notFoundChipStatus: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.inkMuted,
  },
  notFoundTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  notFoundMessage: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 6,
  },
  notFoundActions: {
    width: '100%',
    gap: 10,
  },
  notFoundPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 24,
    backgroundColor: NAVY,
    width: '100%',
  },
  notFoundPrimaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  notFoundBtnIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    width: '100%',
  },
  notFoundSecondaryBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: NAVY,
  },
  notFoundHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    padding: space.lg,
    ...soft,
  },
  notFoundHelpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundHelpTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  notFoundHelpText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
    marginTop: 2,
  },

  sheetSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.inkMuted,
    marginTop: 1,
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...soft,
  },
  billTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  billBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F4F2EE',
  },
  billBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: brand.orange,
  },
  billBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.inkMuted,
  },
  billPieces: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.ink,
  },
  billLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4.5,
  },
  billLineRule: {
    borderTopWidth: 1,
    borderTopColor: '#F2EFEB',
  },
  billLineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F6F3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billLineName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.ink,
  },
  billLineMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkMuted,
    marginTop: 0.5,
  },
  billLineAmount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  billDashed: {
    width: '100%',
    height: 1,
    borderTopWidth: 1.5,
    borderColor: '#E5DFD5',
    borderStyle: 'dashed',
    marginVertical: 5,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  billRowLabel: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.inkMuted,
  },
  billRowValue: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  billSolidLine: {
    height: 1,
    backgroundColor: '#F0ECE4',
    marginVertical: 5,
  },
  billTotalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  billTotalLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  billTotalSub: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: colors.inkMuted,
    marginTop: 1,
  },
  billTotalAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  appliedOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  appliedOfferBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#059669',
  },
  appliedDiscountText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#059669',
  },
  billRowValueMuted: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#94A3B8',
  },
  billTotalAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  billOriginalTotal: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },

  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...soft,
  },
  offerCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  offerCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  offerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedIconCircle: {
    backgroundColor: '#ECFDF5',
  },
  offerSelectTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#0A1C3E',
  },
  offerSelectSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#64748B',
    marginTop: 0.5,
  },
  removeCouponBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  removeCouponText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.danger,
  },
  ticketCarouselScroll: {
    marginHorizontal: -4,
  },
  ticketCarouselContent: {
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 18,
  },
  ticketItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ticketSelectedShadow:
    Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 2px 4px rgba(10, 28, 62, 0.22)) drop-shadow(0 8px 16px rgba(10, 28, 62, 0.18)) drop-shadow(0 16px 24px rgba(10, 28, 62, 0.14))' } as object)
      : { shadowColor: colors.navy, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 },
  ticketCornerBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)' } as object)
      : { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 6 }),
  },
  ticketCornerBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ticketActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 13,
    height: 29,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#D4CBBB',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)', transition: 'all 0.22s ease' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 }),
  },
  ticketActionPillSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)', transition: 'all 0.22s ease' } as object)
      : { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }),
  },
  ticketActionText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.ink,
  },
  ticketActionSavingsText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#059669',
  },
  ticketActionTextSelected: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  paySourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#EAE6DF',
    paddingVertical: 11,
    paddingHorizontal: 13,
    ...soft,
  },
  paySourceCardShort: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFDF9',
  },
  paySourceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payTopUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: brand.orange,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  payTopUpBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  inlineTopUpArea: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4EDE4',
    gap: 8,
  },
  inlineTopUpAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inlineTopUpAlertText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#B45309',
  },
  inlineTopUpChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineTopUpChip: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E1D5',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9,
  },
  inlineTopUpChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  paySourceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF4E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paySourceTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  paySourceBalance: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 1,
  },
  payRadioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paySourceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F8EE',
  },
  paySourceStatusText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: '#0D7A21',
  },
  payAddMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
  },
  payAddMoneyText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  payFooterWrap: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 2,
  },
  paySubmitBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    shadowColor: '#0A1C3E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  paySubmitText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  paySubmitSub: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  deliveredWrap: {
    gap: space.md,
  },
  deliveredConfirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: '#62D487',
    borderRadius: 22,
    borderWidth: 0,
    paddingVertical: 15,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }),
  },
  deliveredConfirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 }),
  },
  deliveredConfirmTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    color: '#0A1C3E',
    letterSpacing: -0.3,
  },
  bookingHeroCard: {
    height: 172,
    borderRadius: 26,
    backgroundColor: '#F1EDE4',
    borderWidth: 1.2,
    borderColor: '#E3DDD0',
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(10, 28, 62, 0.06)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }),
  },
  bookingHeroHalo: {
    position: 'absolute',
    right: -44,
    bottom: -58,
    width: 252,
    height: 252,
    borderRadius: 126,
    backgroundColor: '#FFFFFF',
  },
  bookingHeroArt: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    height: 152,
    width: 152 * (721 / 586),
    ...(Platform.OS === 'web' ? ({ mixBlendMode: 'multiply' } as object) : null),
  },
  bookingHeroBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: space.lg,
    maxWidth: '64%',
  },
  bookingHeroKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  bookingHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
  bookingHeroKickerText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.ink,
  },
  bookingHeroTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  bookingHeroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#0A1C3E',
  },
  bookingHeroCtaText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  orderStatusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 26,
    borderRadius: 13,
  },
  orderStatusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  orderStatusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#0A1C3E',
  },
  qrWellThemed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  lockedQrWellThemed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }),
  },
  codePillThemed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'center',
    marginTop: space.sm,
    height: 40,
    paddingLeft: space.lg,
    paddingRight: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.06)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }),
  },
  codeCopyThemed: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0A1C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  softLinkThemed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    marginTop: space.sm,
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  ticketOfferBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.08)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.06)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 }),
  },
  ticketOfferLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  ticketOfferIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketOfferIconApplied: {
    backgroundColor: '#ECFDF5',
  },
  ticketOfferTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#0A1C3E',
  },
  ticketOfferSub: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 0.5,
  },
  ticketOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F4EFE6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  ticketOfferBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#0A1C3E',
  },
  lockedHeroOriginalAmount: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
});
