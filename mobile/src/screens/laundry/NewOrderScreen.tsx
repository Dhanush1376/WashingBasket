import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  FadeInLeft,
  FadeInRight,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/app/Icon';
import { Rise, useFocusReplay } from '../../components/app/motion';
// RisingSheet replaced by Notifications style sheet
import { TopBar } from '../../components/app/TopBar';
import { KeyValue } from '../../components/app/primitives';
import { ListSkeleton } from '../../components/app/states';
import { BasketCard } from '../../components/laundry/BasketCard';
import { QtyStepper } from '../../components/laundry/QtyStepper';
import { PillField, PillTextArea } from '../../components/ui/SheetForm';
import { useAppUser } from '../../hooks/useAppUser';
import { useCurrentCustomer, useLaundryState, usePincodeLocation } from '../../laundry/hooks';
import { getCampusLogo } from '../../laundry/campusLogos';
import { haptic } from '../../lib/haptics';
import { money } from '../../lib/format';
import { MODE_COPY } from '../../mock/engine/lifecycle';
import { MAX_QTY_PER_ITEM } from '../../mock/engine/ops';
import { priceBasket } from '../../mock/engine/selectors';
import { phoneDigits, slotStarted } from '../../mock/engine/util';
import priceMenu from '../../mock-data/price-menu.json';
import rawPriceList from '../../mock/data/priceList.json';
import { resolveCatalog } from '../../mock/engine/seed';
import { submitOrder } from '../../mock/services/orderService';
import type { Location, ServiceMode } from '../../mock/types';
import type { TabProps } from '../../navigation/types';
import { useSession } from '../../session/session';
import { app, colors, fonts, shape, space, text } from '../../theme';
import type { Offer, ServiceId } from '../../types/models';

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
    id: 'of-1',
    code: 'CLEAN15',
    discountBadge: '15% OFF',
    badgeLabel: 'Special',
    title: '15% off orders',
    description: 'Valid on wash & iron and laundry baskets.',
    validFrom: '2026-10-01',
    validUntil: '2026-12-31',
    eligibility: 'All orders',
    serviceIds: 'all',
    status: 'active',
    discountValue: '15%',
  },
  {
    id: 'of-2',
    code: 'FREEDEL',
    discountBadge: 'FREE DELIVERY',
    badgeLabel: 'Campus Special',
    title: 'Free delivery',
    description: 'Zero delivery fee on your doorstep pickup.',
    validFrom: '2026-10-01',
    validUntil: '2026-12-31',
    eligibility: 'All orders',
    serviceIds: 'all',
    status: 'active',
    discountValue: '₹30',
  },
];

type Step = 'items' | 'pickup' | 'review';
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const STEP_LABEL: Record<Step, string> = { items: 'Items', pickup: 'Pickup', review: 'Review' };

/* The same warm sand as My orders, so the two pages feel related; the yellow basket card glows on it. */
const CANVAS = '#EAE6DB';
const INK = '#0A1C3E'; // the app's dark navy

/** The Home screen's service cards open the matching price-list category. */
const SERVICE_CATEGORY: Record<ServiceId, string> = {
  'only-wash': 'only-wash',
  'wash-iron': 'wash-iron',
  'dry-clean': 'dry-clean',
  stain: 'stain',
  blanket: 'blanket',
  'shoes-bags': 'shoes-bags',
  dye: 'dye',
};

const LOOK: Record<string, { color: string; icon: IconName }> = {
  'only-wash': { color: colors.orange, icon: 'droplet' },
  'wash-iron': { color: colors.navy, icon: 'shirt' },
  'shoes-bags': { color: '#E0553A', icon: 'bag' },
  stain: { color: '#1F9D3A', icon: 'spray' },
  dye: { color: '#C98A00', icon: 'star' },
  'dry-clean': { color: INK, icon: 'shield' },
  blanket: { color: '#4A6FA5', icon: 'package' },
};
const lookOf = (id: string) => LOOK[id] ?? { color: INK, icon: 'sparkle' as IconName };

const UNIT_LABEL: Record<string, string> = {
  'only-wash': 'PER KG',
  'wash-iron': 'PER KG',
  'shoes-bags': 'PER PAIR',
  stain: 'PER PIECE',
  dye: 'PER PIECE',
  'dry-clean': 'PER PIECE',
  blanket: 'PER PIECE',
};

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 4px 18px rgba(10, 28, 62, 0.08), 0 1px 4px rgba(10, 28, 62, 0.04)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 };

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A new laundry order based directly on the official price list:
 * items with quantities -> pickup details (home only) -> review.
 */
export function NewOrderScreen({ navigation, route }: TabProps<'Book'>) {
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const home = usePincodeLocation();
  const { guest, phone } = useAppUser();
  const { signOut } = useSession();
  const insets = useSafeAreaInsets();
  const replay = useFocusReplay(); // the basket card and the sheet rise in each time the tab opens
  const [dir, setDir] = useState(1); // which way the step content slides in: 1 forward, -1 back

  const [step, setStep] = useState<Step>('items');
  const [pickedLocation] = useState<string | null>(null);
  const [pickedMode] = useState<ServiceMode>('OFFICE_DROP_OFF');
  const [, setCategory] = useState<string | null>(null);
  const [seenService, setSeenService] = useState<ServiceId | undefined>(undefined);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [typedContact, setContact] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [pickedSlot, setSlotId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [showOffersPicker, setShowOffersPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locations = useMemo(() => (state ? [...state.locations].sort((a, b) => a.sortOrder - b.sortOrder) : []), [state]);
  // The user's PIN code from login selects the location by default
  const defaultLocation = (home && home.status === 'ACTIVE' ? home : undefined) ?? locations.find((l) => l.status === 'ACTIVE') ?? locations[0];
  const location: Location | undefined = (pickedLocation ? locations.find((l) => l.id === pickedLocation) : undefined) ?? defaultLocation;
  const mode: ServiceMode = location && !location.serviceModes.includes(pickedMode) ? location.serviceModes[0] : pickedMode;
  const campusLogo = getCampusLogo(location);
  const contact = typedContact ?? phoneDigits(phone);

  // A service picked on Home opens its matching price list category
  const serviceParam = route.params?.serviceId;
  if (serviceParam !== seenService) {
    setSeenService(serviceParam);
    if (serviceParam) setCategory(SERVICE_CATEGORY[serviceParam] ?? null);
  }

  // (kept above the early return, so the hooks always run in the same order)
  const fallbackCatalog = useMemo(() => resolveCatalog(rawPriceList as any, priceMenu as any), []);

  const scrollRef = useRef<any>(null);
  const scrollY = useSharedValue(0);

  const onListScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const orangeCardStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    return {
      transform: [
        {
          translateY: interpolate(y, [0, 36], [0, 42], 'clamp'),
        },
      ],
      opacity: interpolate(y, [0, 24], [1, 0], 'clamp'),
    };
  });

  const restingTop = Math.max(insets.top, 6) + 104;
  const targetTop = Math.max(insets.top, 0);
  const lift = restingTop - targetTop;

  const sheetStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const progress = interpolate(y, [0, 60], [0, 1], 'clamp');
    return {
      transform: [
        {
          translateY: -progress * lift,
        },
      ],
      borderTopLeftRadius: interpolate(progress, [0, 1], [28, 0]),
      borderTopRightRadius: interpolate(progress, [0, 1], [28, 0]),
    };
  });

  const handleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    return {
      opacity: interpolate(y, [0, 30], [1, 0], 'clamp'),
      transform: [
        {
          scale: interpolate(y, [0, 30], [1, 0.8], 'clamp'),
        },
      ],
    };
  });

  if (!state) {
    return (
      <View style={styles.root}>
        <View style={[styles.sheetInner, { paddingTop: Math.max(insets.top, 6) + 72 }]}>
          <ListSkeleton rows={3} height={110} />
        </View>
      </View>
    );
  }

  const catalog = (state?.catalog?.categories?.some((c) => c.id === 'only-wash') ? state.catalog : null) ?? fallbackCatalog;
  const basket = Object.entries(qty).map(([itemId, q]) => ({ itemId, qty: q })).filter((b) => b.qty > 0);
  const totalItemsCount = basket.reduce((sum, b) => sum + b.qty, 0);
  const priced = priceBasket(state, mode, basket);
  const charge = catalog.serviceCharges[mode];
  const isHome = mode === 'HOME_PICKUP';

  const discountAmount = (() => {
    if (!appliedOffer) return 0;
    if (appliedOffer.code === 'FIRSTWASH') return Math.round(priced.subtotal * 0.2);
    if (appliedOffer.code === 'CLEAN15') return Math.round(priced.subtotal * 0.15);
    if (appliedOffer.code === 'FREEDEL') return Math.min(priced.serviceCharge || 30, 30);
    if (appliedOffer.discountValue?.includes('%')) {
      const pct = parseInt(appliedOffer.discountValue, 10);
      return Math.round(priced.subtotal * (pct / 100));
    }
    return 20;
  })();

  const finalTotal = Math.max(0, priced.total - discountAmount);
  const steps: Step[] = isHome ? ['items', 'pickup', 'review'] : ['items', 'review'];
  const at = steps.indexOf(step);

  // today is offered only while one of its pickup times is still ahead
  const slotDefs = location?.homePickup?.slots ?? [];
  const todayOpen = slotDefs.some((sl) => !slotStarted(sl, isoDay(new Date())));
  const days = location?.homePickup
    ? Array.from({ length: location.homePickup.daysAhead }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + (todayOpen ? 0 : 1));
        return d;
      })
    : [];
  // a time that has already started today doesn't count as chosen
  const slotId = pickedSlot && day && slotDefs.some((sl) => sl.id === pickedSlot && !slotStarted(sl, day)) ? pickedSlot : null;

  const pickupValid = !isHome || (address.trim().length >= 8 && phoneDigits(contact).length === 10 && !!day && !!slotId);
  const canNext = step === 'items' ? priced.pieces > 0 : step === 'pickup' ? pickupValid : true;

  const go = (to: Step) => {
    setError(null);
    setDir(steps.indexOf(to) >= at ? 1 : -1);
    setStep(to);
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  };
  const next = () => {
    if (step === 'review') return submit();
    go(steps[at + 1]);
  };
  const back = () => (at > 0 ? go(steps[at - 1]) : undefined);

  const reset = () => {
    setStep('items');
    setQty({});
    setNotes('');
    setDay(null);
    setSlotId(null);
    setError(null);
    setAppliedOffer(null);
    setShowOffersPicker(false);
  };

  async function submit() {
    if (guest) {
      signOut();
      return;
    }
    if (!customer || !location) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await submitOrder({
        customerId: customer.id,
        locationId: location.id,
        serviceMode: mode,
        basket,
        discount: discountAmount,
        couponCode: appliedOffer?.code,
        pickup: isHome
          ? {
              address: address.trim(),
              landmark: landmark.trim() || undefined,
              contactPhone: contact,
              date: day!,
              slotId: slotId!,
            }
          : undefined,
        instructions: notes.trim() || undefined,
      });
      haptic.success();
      reset();
      navigation.navigate('LaundryOrder', { orderId: created.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel =
    step === 'review'
      ? guest
        ? 'Sign in to order'
        : `Unlock QR · Pay ${money(finalTotal)}`
      : 'Continue';

  // the checkout bar: dark, floating just above the tab bar, with the total in yellow
  const ctaOff = !canNext || (!guest && step === 'review' && !customer);
  const footer = (
    <Rise
      replay={replay}
      delay={320}
      distance={30}
      style={[
        styles.footer,
        { bottom: Math.max(insets.bottom, 12) + 68 },
        error ? { height: undefined, paddingVertical: 8 } : null,
      ]}
    >
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Icon name="alert" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <View style={styles.footerRow}>
        {at > 0 ? (
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.backBtn, webCursor, pressed && { opacity: 0.7 }]}>
            <Icon name="chevronLeft" size={18} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        ) : null}
        <View style={styles.flex}>
          <Text style={[styles.total, at === 0 && styles.totalPad]}>
            {money(step === 'review' ? finalTotal : priced.total)}
          </Text>
        </View>
        <Pressable
          onPress={next}
          disabled={ctaOff || submitting}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={({ pressed }) => [
            styles.cta,
            webCursor,
            ctaOff && styles.ctaOff,
            pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
          ]}
        >
          <Text style={styles.ctaText}>{submitting ? 'Sending…' : ctaLabel}</Text>
          <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>
    </Rise>
  );

  const enter = (dir > 0 ? FadeInRight : FadeInLeft).duration(340);
  const place = location ? `${location.shortName} · ${MODE_COPY[mode].short}` : undefined;

  return (
    <View style={styles.root}>
      {/* ── Top stage: TopBar ── */}
      <View style={[styles.page, { paddingTop: Math.max(insets.top, 6) }]}>
        <Rise replay={replay} distance={8}>
          <TopBar padded={false} title="New order" />
        </Rise>
      </View>

      {/* ── Orange card behind the drawer sheet ── */}
      <Animated.View
        style={[
          styles.orangeCardWrap,
          { top: Math.max(insets.top, 6) + 68 },
          orangeCardStyle,
        ]}
      >
        <BasketCard
          total={step === 'review' ? finalTotal : priced.total}
          pieces={priced.pieces}
          place={place}
        />
      </Animated.View>

      {/* ── White App Drawer Sheet (slides up on scroll) ── */}
      <Animated.View
        nativeID="new-order-sheet"
        style={[
          styles.sheet,
          { top: restingTop, bottom: -lift },
          sheetStyle,
        ]}
      >
        <View style={styles.sheetInner}>
          {/* Subtle drag handle */}
          <Animated.View style={[styles.handleHit, handleStyle]}>
            <View style={styles.handle} />
          </Animated.View>

          {/* Drawer Header: Title, Category Count, Step Navigation */}
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitleGroup}>
              <Text style={styles.sheetTitle}>
                {step === 'items' ? 'All services' : step === 'pickup' ? 'Pickup details' : 'Order review'}
              </Text>
              {step === 'items' ? (
                <Text style={styles.sheetCount}>{catalog.categories.length} categories</Text>
              ) : step === 'review' ? (
                <Text style={styles.sheetCount}>{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}</Text>
              ) : null}
            </View>

            {/* Stepper tracker */}
            <View style={styles.stepsWrap}>
              {steps.map((st, i) => {
                const isCurrent = i === at;
                const isDone = i < at;
                return (
                  <Pressable
                    key={st}
                    disabled={!isDone}
                    onPress={() => go(st)}
                    accessibilityRole="button"
                    accessibilityLabel={`Step ${i + 1}, ${STEP_LABEL[st]}`}
                    style={[
                      styles.stepChip,
                      isCurrent && styles.stepChipActive,
                      isDone && styles.stepChipDone,
                      isDone && webCursor,
                    ]}
                  >
                    <View style={[styles.stepDot, isDone ? styles.stepDotDone : isCurrent ? styles.stepDotActive : styles.stepDotIdle]}>
                      {isDone ? (
                        <Icon name="check" size={8} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextActive]}>{i + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive, isDone && styles.stepLabelDone]}>
                      {STEP_LABEL[st]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.sub} numberOfLines={1}>
            {step === 'items'
              ? 'Add each item and how many · Mix services in one order'
              : step === 'pickup'
              ? 'Choose your address, pickup day and time slot'
              : isHome
              ? 'Check your items and pickup details'
              : 'Check your items and drop-off location'}
          </Text>

          <View style={styles.headingDivider} />

          {/* Animated ScrollView for step contents */}
          <Animated.ScrollView
            ref={scrollRef}
            style={styles.sheetScroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 12) + 160 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onListScroll}
            scrollEventThrottle={16}
          >
            {step === 'items' ? (
              <Animated.View key="items" entering={enter}>
            {catalog.categories.map((c, catIdx) => {
              const look = lookOf(c.id);
              const unit = UNIT_LABEL[c.id] ?? (c.items[0]?.unit === 'kg' ? 'PER KG' : c.items[0]?.unit === 'pair' ? 'PER PAIR' : 'PER PIECE');
              return (
                <View key={c.id} style={[styles.catSection, catIdx > 0 && styles.catSectionNext]}>
                  <View style={[styles.catCard, soft]}>
                    <View style={styles.cardHead}>
                      <View style={[styles.ribbon, { backgroundColor: look.color }]}>
                        <Icon name={look.icon} size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.ribbonText} numberOfLines={1}>
                          {c.name}
                        </Text>
                      </View>
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>{unit}</Text>
                      </View>
                    </View>
                    <View style={styles.cardDashedLine} />
                    <View style={styles.catItems}>
                      {c.items.map((item, i) => {
                        const [baseName, variant] = item.name.includes(' · ') ? item.name.split(' · ') : [item.name, null];
                        return (
                          <View key={item.id} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                            <View style={styles.flex}>
                              <View style={styles.itemNameRow}>
                                <Text style={styles.itemName} numberOfLines={1}>{baseName}</Text>
                                {variant ? (
                                  <View style={[styles.sizeChip, variant.toLowerCase().includes('double') ? styles.sizeChipDouble : styles.sizeChipSingle]}>
                                    <Text style={[styles.sizeChipText, variant.toLowerCase().includes('double') ? styles.sizeChipTextDouble : styles.sizeChipTextSingle]}>
                                      {variant}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.itemPriceRow}>
                                <Text style={styles.itemPrice}>{money(item.price)}</Text>
                                <Text style={styles.itemUnit}> / {item.unit}</Text>
                              </View>
                            </View>
                            <QtyStepper
                              value={qty[item.id] ?? 0}
                              max={MAX_QTY_PER_ITEM}
                              label={item.name}
                              onChange={(n) => setQty((q) => ({ ...q, [item.id]: n }))}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        ) : null}

        {step === 'pickup' && location?.homePickup ? (
          <Animated.View key="pickup" entering={enter}>
            <View style={styles.partner}>
              <Icon name="truck" size={18} color={colors.navy} />
              <Text style={[text.bodyStrong, styles.flex]}>We collect from your door</Text>
            </View>
            <Text style={styles.label}>Pickup address</Text>
            <PillTextArea value={address} onChangeText={setAddress} placeholder="House / flat, street, area" accessibilityLabel="Pickup address" invalid={address.length > 0 && address.trim().length < 8} />
            <Text style={styles.label}>Landmark (optional)</Text>
            <PillField value={landmark} onChangeText={setLandmark} placeholder="Near…" icon="mapPin" />
            <Text style={styles.label}>Contact number</Text>
            <PillField
              value={contact}
              onChangeText={(t) => setContact(t.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              icon="phone"
              invalid={contact.length > 0 && contact.length !== 10}
            />
            <Text style={styles.label}>Pickup day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.pills}>
              {days.map((d, i) => {
                const id = isoDay(d);
                const on = day === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      haptic.tap();
                      setDay(id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    style={[styles.dateChip, on && styles.dark, webCursor]}
                  >
                    <Text style={[styles.dateWeek, on && styles.onSoft]}>{i + (todayOpen ? 0 : 1) === 0 ? 'Today' : i + (todayOpen ? 0 : 1) === 1 ? 'Tmrw' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
                    <Text style={[styles.dateDay, on && styles.on]}>{d.getDate()}</Text>
                    <Text style={[styles.dateWeek, on && styles.onSoft]}>{d.toLocaleDateString('en-IN', { month: 'short' })}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.label}>Time</Text>
            <View style={styles.slots}>
              {location.homePickup.slots.map((sl) => {
                const on = slotId === sl.id;
                const gone = !!day && slotStarted(sl, day);
                return (
                  <Pressable
                    key={sl.id}
                    onPress={() => {
                      haptic.tap();
                      setSlotId(sl.id);
                    }}
                    disabled={gone}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: gone }}
                    accessibilityLabel={`${sl.period}, ${sl.label}${gone ? ', already started' : ''}`}
                    style={[styles.slot, on && styles.dark, gone && styles.slotGone, !gone && webCursor]}
                  >
                    <Text style={[styles.dateWeek, on && styles.onSoft]}>{gone ? 'Started' : sl.period}</Text>
                    <Text style={[styles.slotLabel, on && styles.on, gone && styles.slotLabelGone]}>{sl.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Instructions for the partner (optional)</Text>
            <PillTextArea value={notes} onChangeText={setNotes} placeholder="Gate code, call on arrival, fabric care…" accessibilityLabel="Instructions" />
          </Animated.View>
        ) : null}

        {step === 'review' && location ? (
          <Animated.View key="review" entering={enter}>
            <View style={[styles.reviewCard, soft]}>
              <View style={styles.officeRow}>
                {campusLogo ? (
                  <View style={styles.campusLogoBadge}>
                    <Image source={campusLogo} style={styles.campusLogoImg} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={styles.campusIconBadge}>
                    <Icon name="mapPin" size={18} color={colors.navy} />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>{location.name}</Text>
                  <Text style={text.caption}>{MODE_COPY[mode].label}</Text>
                </View>
              </View>
              {isHome && day && slotId ? (
                <View style={[styles.officeRow, { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: '#F4F1EB' }]}>
                  <Icon name="calendar" size={18} color={colors.navy} />
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>
                      {new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {location.homePickup?.slots.find((x) => x.id === slotId)?.label}
                    </Text>
                    <Text style={text.caption} numberOfLines={2}>
                      {address.trim()}
                      {landmark.trim() ? ` · ${landmark.trim()}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => go('pickup')} accessibilityRole="button" accessibilityLabel="Change pickup details" style={webCursor}>
                    <Text style={styles.link}>Change</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={[styles.reviewCard, styles.reviewCardNext, soft]}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewSectionTitle}>Items</Text>
                <Pressable onPress={() => go('items')} accessibilityRole="button" accessibilityLabel="Edit items" style={webCursor}>
                  <Text style={styles.link}>Edit</Text>
                </Pressable>
              </View>
              {priced.lines.map((l, idx) => (
                <View key={l.item.id} style={[styles.line, idx > 0 && styles.reviewItemDivider]}>
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>{l.item.name}</Text>
                    <Text style={text.caption}>
                      {l.categoryName} · {l.qty} × {money(l.item.price)}
                    </Text>
                  </View>
                  <Text style={styles.lineAmount}>{money(l.amount)}</Text>
                </View>
              ))}
            </View>

            {/* Offers & Coupons Selection Card */}
            <View style={[styles.reviewCard, styles.reviewCardNext, soft]}>
              {appliedOffer ? (
                <View style={styles.appliedCardRow}>
                  <View style={styles.appliedCardLeft}>
                    <View style={styles.appliedIconCircle}>
                      <Icon name="tag" size={16} color="#059669" strokeWidth={2.4} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.appliedTitleRow}>
                        <Text style={styles.appliedCode}>{appliedOffer.code}</Text>
                        <View style={styles.savingsPill}>
                          <Text style={styles.savingsPillText}>Saved {money(discountAmount)}</Text>
                        </View>
                      </View>
                      <Text style={styles.appliedDesc}>{appliedOffer.title}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      haptic.tap();
                      setAppliedOffer(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove coupon"
                    style={({ pressed }) => [styles.removeCouponBtn, webCursor, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.removeCouponText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <Pressable
                    onPress={() => {
                      haptic.tap();
                      setShowOffersPicker(!showOffersPicker);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Apply coupon or offer"
                    style={({ pressed }) => [styles.offerSelectRow, webCursor, pressed && { opacity: 0.8 }]}
                  >
                    <View style={styles.offerSelectLeft}>
                      <View style={styles.offerIconCircle}>
                        <Icon name="tag" size={16} color={colors.orange} strokeWidth={2.4} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.offerSelectTitle}>Apply Coupon / Offer</Text>
                        <Text style={styles.offerSelectSub}>
                          {DEFAULT_OFFERS.length} available offers · Save up to 20%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.offerSelectRight}>
                      <Text style={styles.offerSelectActionText}>
                        {showOffersPicker ? 'Hide' : 'Select'}
                      </Text>
                      <Icon
                        name={showOffersPicker ? 'chevronDown' : 'chevronRight'}
                        size={14}
                        color={colors.navy}
                        strokeWidth={2.4}
                      />
                    </View>
                  </Pressable>

                  {showOffersPicker ? (
                    <View style={styles.offersPickerList}>
                      {DEFAULT_OFFERS.map((offer) => {
                        const estDiscount =
                          offer.code === 'FIRSTWASH'
                            ? Math.round(priced.subtotal * 0.2)
                            : offer.code === 'CLEAN15'
                            ? Math.round(priced.subtotal * 0.15)
                            : offer.code === 'FREEDEL'
                            ? Math.min(priced.serviceCharge || 30, 30)
                            : 20;

                        return (
                          <View key={offer.id} style={styles.offerItemRow}>
                            <View style={styles.offerItemLeft}>
                              <View style={styles.offerItemBadgeRow}>
                                <Text style={styles.offerItemCode}>{offer.code}</Text>
                                <View style={styles.offerBadgeTag}>
                                  <Text style={styles.offerBadgeTagText}>{offer.discountBadge}</Text>
                                </View>
                              </View>
                              <Text style={styles.offerItemTitle}>{offer.title}</Text>
                              <Text style={styles.offerItemSavings}>Saves {money(estDiscount)} on this order</Text>
                            </View>
                            <Pressable
                              onPress={() => {
                                haptic.success();
                                setAppliedOffer(offer);
                                setShowOffersPicker(false);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Apply coupon ${offer.code}`}
                              style={({ pressed }) => [styles.applyBtn, webCursor, pressed && { transform: [{ scale: 0.96 }] }]}
                            >
                              <Text style={styles.applyBtnText}>APPLY</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <View style={[styles.reviewCard, styles.reviewCardNext, soft]}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewSectionTitle}>Bill summary</Text>
              </View>
              <KeyValue label="Subtotal" value={money(priced.subtotal)} />
              <KeyValue label={charge.label} value={priced.serviceCharge ? money(priced.serviceCharge) : 'Free'} />
              {appliedOffer ? (
                <KeyValue label={`Coupon (${appliedOffer.code})`} value={`- ${money(discountAmount)}`} valueColor="#059669" />
              ) : null}
              <View style={styles.totalRow}>
                <Text style={text.h2}>Total</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  {appliedOffer ? (
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: '#71717A', textDecorationLine: 'line-through' }}>
                      {money(priced.total)}
                    </Text>
                  ) : null}
                  <Text style={styles.totalBig}>{money(finalTotal)}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
          </Animated.ScrollView>
        </View>
      </Animated.View>

      {/* Opaque white fade behind checkout bar and tab bar */}
      <View pointerEvents="none" style={styles.bottomFade}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="bottomFadeGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomFadeGrad)" />
        </Svg>
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CANVAS },
  page: { paddingHorizontal: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  orangeCardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: 14,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DA',
    zIndex: 5,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -6px 24px rgba(10, 28, 62, 0.08)' } as object)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 8,
        }),
  },
  sheetInner: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  handleHit: {
    alignSelf: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sheetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: INK,
  },
  sheetCount: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F4F2EE',
  },
  stepChipActive: {
    backgroundColor: '#FFF0E6',
  },
  stepChipDone: {
    backgroundColor: '#F0FDF4',
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotIdle: {
    backgroundColor: '#D5D9E0',
  },
  stepDotActive: {
    backgroundColor: colors.orange,
  },
  stepDotDone: {
    backgroundColor: '#059669',
  },
  stepDotText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#64748B',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: '#64748B',
  },
  stepLabelActive: {
    fontFamily: fonts.bold,
    color: colors.orange,
  },
  stepLabelDone: {
    fontFamily: fonts.semibold,
    color: '#059669',
  },
  sub: {
    paddingHorizontal: space.lg,
    marginTop: 2,
    marginBottom: space.xs,
    color: colors.inkSoft,
    fontSize: 12.5,
  },
  headingDivider: {
    height: 1,
    backgroundColor: '#E8E4DA',
    marginTop: 8,
    marginBottom: space.xs,
    marginHorizontal: space.lg,
  },
  sheetScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  label: { ...text.h2, fontSize: 15, marginTop: space.lg, marginBottom: space.sm },
  flex: { flex: 1 },


  catSection: { marginTop: space.sm },
  catSectionNext: { marginTop: space.lg },
  catCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: space.lg,
    borderWidth: 1,
    borderColor: '#CDD2DA',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 18px rgba(10, 28, 62, 0.08), 0 1px 4px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 }),
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDashedLine: {
    borderTopWidth: 1,
    borderColor: '#CDD2DA',
    borderStyle: 'dashed',
    marginTop: 14,
    marginBottom: 2,
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  ribbonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  unitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  catItems: { marginTop: 0 },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: colors.ink,
    flex: 1,
  },
  sizeChip: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sizeChipSingle: {
    backgroundColor: '#EEF3FB',
    borderColor: '#D4E2F5',
  },
  sizeChipDouble: {
    backgroundColor: '#FFF4E5',
    borderColor: '#FED7AA',
  },
  sizeChipText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sizeChipTextSingle: {
    color: '#013E86',
  },
  sizeChipTextDouble: {
    color: '#C25E00',
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  itemUnit: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.inkSoft,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  itemDivider: { borderTopWidth: 1, borderTopColor: '#F4F1EB' },

  bleed: { marginHorizontal: -space.lg },
  pills: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xs },

  modes: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  mode: { flex: 1, padding: space.md, borderRadius: shape.inner, borderWidth: 1, borderColor: app.hairline, backgroundColor: app.card },
  modeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  dark: { backgroundColor: colors.navy, borderColor: colors.navy },
  on: { color: '#FFFFFF' },
  onSoft: { color: 'rgba(255, 255, 255, 0.72)' },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },

  partner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: '#EEF3FB', marginVertical: space.md },
  dateChip: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: 12, borderWidth: 1, borderColor: app.hairline, backgroundColor: app.card, alignItems: 'center', minWidth: 62 },
  dateWeek: { fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted },
  dateDay: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginVertical: 2 },

  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { flex: 1, minWidth: 140, padding: space.md, borderRadius: 12, borderWidth: 1, borderColor: app.hairline, backgroundColor: app.card },
  slotLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 2 },
  slotGone: { opacity: 0.4 },
  slotLabelGone: { textDecorationLine: 'line-through' },

  basket: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 18px rgba(10, 28, 62, 0.08), 0 1px 4px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 }),
  },
  basketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },

  reviewCard: {
    marginTop: space.sm,
    padding: space.lg,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CDD2DA',
  },
  reviewCardNext: { marginTop: space.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  reviewSectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  reviewItemDivider: { borderTopWidth: 1, borderTopColor: '#F4F1EB' },
  officeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  campusLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  campusLogoImg: {
    width: 44,
    height: 44,
  },
  campusIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  lineAmount: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: app.hairline },
  totalBig: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.orange },

  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 155,
    zIndex: 10,
  },
  footer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    height: 58,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: app.hairline,
    justifyContent: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 20px rgba(10, 28, 62, 0.08), 0 2px 4px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }),
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0A1C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  total: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink, marginLeft: 8 },
  totalPad: { marginLeft: 14 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 23,
    backgroundColor: '#0A1C3E',
    minWidth: 124,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm, padding: space.sm, backgroundColor: '#FDECEE', borderRadius: 8 },
  errorText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },

  offerSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  offerSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  offerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF4EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerSelectTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.ink,
  },
  offerSelectSub: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 2,
  },
  offerSelectRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1EDE4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  offerSelectActionText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  offersPickerList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F4F1EB',
    gap: 10,
  },
  offerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#EFECE6',
  },
  offerItemLeft: {
    flex: 1,
    paddingRight: 8,
  },
  offerItemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  offerItemCode: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.navy,
  },
  offerBadgeTag: {
    backgroundColor: '#FFF4EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offerBadgeTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: colors.orange,
  },
  offerItemTitle: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.ink,
  },
  offerItemSavings: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: '#059669',
    marginTop: 2,
  },
  applyBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  applyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  appliedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  appliedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appliedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedCode: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#059669',
  },
  savingsPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#065F46',
  },
  appliedDesc: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 2,
  },
  removeCouponBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  removeCouponText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.danger,
  },
});
