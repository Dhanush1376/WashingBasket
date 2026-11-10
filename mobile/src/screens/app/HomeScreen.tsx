import React from "react";
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ART, ART_TINT, STAGE_ART } from "../../components/app/art";
import {
  CollapsingBar,
  useCollapsingBar,
} from "../../components/app/CollapsingBar";
import { Rise, useFocusReplay } from "../../components/app/motion";
import { Icon } from "../../components/app/Icon";
import { OrderRow } from "../../components/app/orders";
import { LaundryOrderRow } from "../../components/laundry/LaundryOrderRow";
import { TopBar, titleSubStyle } from "../../components/app/TopBar";
import { Card, SectionHeader } from "../../components/app/primitives";
import { ORDER_STATUS, STAGE_LABEL } from "../../components/app/status";
import { EmptyState, ErrorState, Skeleton } from "../../components/app/states";
import { OfferShowcase } from "../../components/home/OfferShowcase";
import { AddressesDrawer, type NewAddress } from "../../components/profile/ProfileDrawers";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { OverviewGrid } from "../../components/home/OverviewGrid";
import { PriceTeaser } from "../../components/home/PriceTeaser";
import { ReferCard } from "../../components/home/ReferCard";
import { useCurrentCustomer, useLaundryState } from "../../laundry/hooks";
import { findLocation, ordersForCustomer } from "../../mock/engine/selectors";
import { useAppUser } from "../../hooks/useAppUser";
import { dayDate, money, plural } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import { invalidate, keys, triggerAppRefresh, useQuery } from "../../lib/query";
import type { TabProps } from "../../navigation/types";
import {
  addAddress,
  getAddresses,
  getReferrals,
  getWallet,
  listOffers,
  setDefaultAddress,
} from "../../services/mock/account.service";
import { addProfileAddress, getSavedAddresses, setDefaultProfileAddress } from "../../services/mock/profile.service";
import { slotById } from "../../services/mock/booking.service";
import {
  getDashboardContent,
  listNotifications,
} from "../../services/mock/engagement.service";
import {
  isActive,
  listOrders,
  stageIndex,
} from "../../services/mock/orders.service";
import { listRequests } from "../../services/mock/requests.service";
import {
  getPriceMenu,
  getServices,
  serviceById,
  startingPrice,
} from "../../services/mock/pricing.service";
import { app, colors, fonts, shape, space, text } from "../../theme";
import { ORDER_STAGES } from "../../types/models";

const webCursor =
  Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;

export function HomeScreen({ navigation }: TabProps<"Home">) {
  const insets = useSafeAreaInsets();
  const replay = useFocusReplay(); // Home's entrance plays each time you open it
  const { firstName, guest } = useAppUser();
  const [addressBoxOpen, setAddressBoxOpen] = React.useState(false);

  const content = useQuery(keys.dashboard, getDashboardContent);
  const orders = useQuery(keys.orders, listOrders);
  const services = useQuery(keys.services, getServices);
  const notifications = useQuery(keys.notifications, listNotifications);
  const addresses = useQuery(keys.addresses, getAddresses);
  // the same saved-addresses drawer as Profile, so picking an address looks and works the same everywhere
  const savedAddresses = useQuery(keys.profileAddresses, getSavedAddresses);
  const makeDefault = async (id: string) => {
    await Promise.all([setDefaultProfileAddress(id), setDefaultAddress(id)]);
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
    setTimeout(() => setAddressBoxOpen(false), 280); // let the tick land, then close
  };
  const addNewAddress = async (input: NewAddress) => {
    const [saved] = await Promise.all([addProfileAddress(input), addAddress(input)]);
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
    return saved;
  };
  const requests = useQuery(keys.requests, listRequests);
  const wallet = useQuery(keys.wallet, getWallet);
  const offers = useQuery(keys.offers, listOffers);
  const referrals = useQuery(keys.referrals, getReferrals);
  const priceMenu = useQuery(keys.priceMenu, getPriceMenu);

  // the top bar tucks away while you read down and drops back the moment you scroll up
  const bar = useCollapsingBar();
  const day = dayPart();
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  const laundryOrders = state && customer && !guest ? ordersForCustomer(state, customer.id) : [];
  const recentLaundry = laundryOrders.slice(0, 3);

  const home = addresses.data?.find((a) => a.isDefault);
  const myOrders = guest ? [] : (orders.data ?? []);
  // the order furthest along leads: it has the most to show
  const active = myOrders
    .filter((o) => isActive(o.status))
    .sort((a, b) => stageIndex(b.status) - stageIndex(a.status));
  const recent = myOrders.slice(0, 3);
  const hasOrders = recentLaundry.length > 0 || recent.length > 0;
  const openOrder = (orderId: string) =>
    navigation.navigate("OrderDetail", { orderId });

  // the four-card overview under the greeting
  const completedCount = myOrders.filter(
    (o) => o.status === "delivered",
  ).length;
  const lead = active[0];
  const leadIdx = lead ? stageIndex(lead.status) : -1;
  const leadNext =
    lead && leadIdx >= 0 && leadIdx < ORDER_STAGES.length - 1
      ? STAGE_LABEL[ORDER_STAGES[leadIdx + 1]]
      : undefined;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = (guest ? [] : (requests.data ?? []))
    .filter(
      (r) =>
        (r.status === "pending" || r.status === "confirmed") &&
        r.pickupDate.slice(0, 10) >= todayKey,
    )
    .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate))[0];
  const nextPickup = upcoming
    ? {
        when: dayDate(upcoming.pickupDate),
        slot: slotById(upcoming.slotId)?.label ?? "",
        service: serviceById(upcoming.serviceId).name,
        status: upcoming.status,
      }
    : null;

  const [pullRefreshing, setPullRefreshing] = React.useState(false);
  const handlePullRefresh = React.useCallback(async () => {
    setPullRefreshing(true);
    haptic.tap();
    await triggerAppRefresh();
    setPullRefreshing(false);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: bar.height,
          paddingBottom: Math.max(insets.bottom, 12) + 64,
        }}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.orange}
            colors={[colors.orange, colors.navy]}
          />
        }
      >
        <View style={styles.body}>
          {/* Greeting, in the same heavy type as "Explore more". Every block below rises into place one after another
            each time Home opens. */}
          <Rise replay={replay} distance={10}>
            <View style={styles.greeting}>
              <Text style={styles.hello} accessibilityRole="header">
                Hello,{"\n"}
                {firstName && !guest ? firstName : "there"}!
              </Text>
              {/* the other side: the time of day and today's date, so the greeting isn't alone on its line */}
              <View
                style={styles.today}
                accessibilityLabel={`Slots open today, ${day.date}`}
              >
                <View style={styles.todayLabelRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.todayLabel}>Slots open today</Text>
                </View>
                <Text style={styles.todayDate}>{day.date}</Text>
              </View>
            </View>
          </Rise>

          {/* The four numbers that matter, at a glance. Shown to everyone: a guest, or someone with nothing on the go,
            sees the same cards at zero, with Book now in the pickup slot. */}
          <Rise replay={replay} delay={70} distance={16} scale={0.97}>
            <OverviewGrid
              active={{
                count: active.length,
                leadId: lead?.id,
                leadStatus: lead ? ORDER_STATUS[lead.status].label : undefined,
                leadNext,
                leadArt:
                  lead && lead.status !== "cancelled"
                    ? STAGE_ART[lead.status]
                    : undefined,
                delivery: lead ? dayDate(lead.estimatedDelivery) : undefined,
              }}
              completed={completedCount}
              balance={
                guest
                  ? money(0)
                  : wallet.data
                    ? money(wallet.data.balance)
                    : "—"
              }
              pending={
                !guest && wallet.data?.pending
                  ? money(wallet.data.pending)
                  : undefined
              }
              next={nextPickup}
              onActive={() =>
                navigation.navigate("Orders", { filter: "active" })
              }
              onCompleted={() =>
                navigation.navigate("Orders", { filter: "completed" })
              }
              onWallet={() => navigation.navigate("Wallet")}
              onNext={() => navigation.navigate("Orders")}
              onOpenOrder={(orderId) =>
                navigation.navigate("LaundryOrder", { orderId })
              }
            />
          </Rise>

          {/* a light breather between the numbers and the booking card: the promises, as a plain line, no box */}
          <Rise replay={replay} delay={140} distance={8}>
            <View
              style={styles.perks}
              accessibilityRole="text"
              accessibilityLabel="Free pickup, 48 hour delivery, quality care"
            >
              {PERKS.map((k, i) => (
                <React.Fragment key={k.label}>
                  {i ? <View style={styles.perkSep} /> : null}
                  <View style={styles.perk}>
                    <Icon
                      name={k.icon}
                      size={13.5}
                      color={k.tint}
                      strokeWidth={2}
                    />
                    <Text style={styles.perkText} numberOfLines={1}>
                      {k.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </Rise>

          <Rise replay={replay} delay={200} distance={16} scale={0.98}>
            {/* Booking: sleek horizontal card with ironing illustration */}
            <Pressable
              onPress={() => navigation.navigate("Book")}
              accessibilityRole="button"
              accessibilityLabel={`${content.data?.booking.cta ?? "Book a Pickup"}. ${content.data?.booking.title ?? "Fresh clothes, just a pickup away"}`}
              style={({ pressed }) => [
                styles.bookingCard,
                webCursor,
                pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
              ]}
            >
              {/* a soft warm halo, then the ironing illustration leaning off the bottom-right corner */}
              <View style={styles.bookingHalo} />
              <Image
                source={ART.steam}
                style={styles.bookingArt}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={styles.bookingBody}>
                <View style={styles.bookingKicker}>
                  <View style={styles.bookingDot} />
                  <Text style={styles.bookingKickerText}>Book a pickup</Text>
                </View>
                <Text style={styles.bookingTitle}>
                  Fresh clothes,{"\n"}at your door
                </Text>
                <View style={styles.bookingCta}>
                  <Text style={styles.bookingCtaText}>Book now</Text>
                  <Icon
                    name="arrowRight"
                    size={14}
                    color="#FFFFFF"
                    strokeWidth={2.2}
                  />
                </View>
              </View>
            </Pressable>
          </Rise>

          <Rise replay={replay} delay={260} distance={16}>
            {/* Recent orders */}
            <SectionHeader
              style={{ marginTop: space.xl }}
              title="Recent orders"
              action={hasOrders ? "View all" : undefined}
              onAction={() => navigation.navigate("Orders")}
            />
            {orders.loading ? (
              <View style={{ gap: space.md }}>
                <Skeleton height={112} radius={shape.tile} />
                <Skeleton height={112} radius={shape.tile} />
              </View>
            ) : recentLaundry.length > 0 ? (
              <View style={{ gap: space.md }}>
                {recentLaundry.map((o, i) => (
                  <LaundryOrderRow
                    key={o.id}
                    order={o}
                    index={i}
                    location={state ? findLocation(state, o.locationId) : undefined}
                    onPress={() => navigation.navigate("LaundryOrder", { orderId: o.id })}
                  />
                ))}
              </View>
            ) : recent.length ? (
              <View style={{ gap: space.md }}>
                {recent.map((o, i) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    index={i}
                    onPress={() => openOrder(o.id)}
                  />
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState
                  icon="bag"
                  title="No orders yet"
                  message="Your orders will appear here after your first pickup."
                />
              </Card>
            )}

            {/* Services */}
            <SectionHeader
              style={{ marginTop: space.xl }}
              title="Our services"
              action="Price list"
              onAction={() => navigation.navigate("PriceList")}
            />
          </Rise>
        </View>
        <Rise replay={replay} delay={320} distance={16}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesRow}
          >
            {services.loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <Skeleton
                    key={i}
                    height={196}
                    width={156}
                    radius={shape.tile}
                  />
                ))
              : services.data?.map((s) => {
                  const from = startingPrice(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() =>
                        navigation.navigate("Book", { serviceId: s.id })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name}${from ? `, from ${money(from.price)} per ${from.unit}` : ""}`}
                      style={({ pressed }) => [
                        styles.service,
                        webCursor,
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.serviceArt,
                          { backgroundColor: ART_TINT[s.art] ?? app.cream },
                        ]}
                      >
                        <Image
                          source={ART[s.art]}
                          style={styles.fill}
                          resizeMode="cover"
                        />
                      </View>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      {from ? (
                        <Text style={text.caption}>
                          from{" "}
                          <Text style={styles.servicePrice}>
                            {money(from.price)}
                          </Text>{" "}
                          / {from.unit}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
          </ScrollView>
        </Rise>

        <Rise replay={replay} delay={380} distance={16}>
          <View style={styles.body}>
            {/* Offers: one warm card holding the hand of coupons, which shuffles itself; tap one to open it on Offers */}
            {offers.data?.length ? (
              <View style={styles.offers}>
                <SectionHeader
                  title="Available offers"
                  action="View all"
                  onAction={() => navigation.navigate("Offers")}
                />
                <OfferShowcase
                  offers={offers.data}
                  onOpen={(offerId) =>
                    navigation.navigate("Offers", { offerId })
                  }
                />
              </View>
            ) : null}

            {/* a small taste of the price list, read like a menu */}
            {priceMenu.data ? (
              <PriceTeaser
                sections={priceMenu.data.sections}
                onOpen={() => navigation.navigate("PriceList")}
              />
            ) : null}

            {/* Refer & earn: a quiet white card like the price list below, with your code ready to share */}
            {referrals.data ? (
              <View style={styles.referSection}>
                <SectionHeader
                  title="Refer & earn"
                  action="Details"
                  onAction={() => navigation.navigate("Refer")}
                />
                <ReferCard
                  reward={referrals.data.rewardPerReferral}
                  friendReward={referrals.data.rules.welcomeReward}
                  code={guest ? undefined : referrals.data.code}
                  invited={referrals.data.history.length}
                  joined={
                    referrals.data.history.filter((r) => r.status !== "invited")
                      .length
                  }
                  earned={referrals.data.earned}
                  onOpen={() => navigation.navigate("Refer")}
                />
              </View>
            ) : null}
          </View>
        </Rise>
      </Animated.ScrollView>

      {/* Top bar: one calm row over the page. The logo mark is the brand, the address is the content, two round
          buttons act. It slides away as you read down, comes back as you scroll up, and turns to frosted glass once
          the page moves under it. */}
      <CollapsingBar
        bar={bar}
        style={{ paddingTop: Math.max(insets.top, 6), paddingBottom: space.sm }}
      >
        <TopBar
          dot={home ? "#22A04B" : colors.inkMuted}
          title={home ? home.label : "Add address"}
          subtitle={
            home ? home.line2 || home.line1 : "Add an address for pickup"
          }
          titleLabel={
            home
              ? `${home.label}, ${home.line2 || home.line1}`
              : "Add an address"
          }
          onPressTitle={() => setAddressBoxOpen((v) => !v)}
        />
      </CollapsingBar>

      <BottomSheet visible={addressBoxOpen} onClose={() => setAddressBoxOpen(false)}>
        {savedAddresses.data ? (
          <AddressesDrawer addresses={savedAddresses.data} onMakeDefault={makeDefault} onAdd={addNewAddress} />
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** Morning, afternoon or evening, with a matching sun or moon, and today's date ("Thu, 5 Nov"). */
function dayPart() {
  const now = new Date();
  const h = now.getHours();
  const date = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (h < 12)
    return {
      label: "Good morning",
      icon: "sun" as const,
      bg: app.yellow,
      fg: colors.ink,
      date,
    };
  if (h < 17)
    return {
      label: "Good afternoon",
      icon: "sun" as const,
      bg: colors.orange,
      fg: "#FFFFFF",
      date,
    };
  return {
    label: "Good evening",
    icon: "moon" as const,
    bg: "#0A1C3E",
    fg: app.yellow,
    date,
  };
}

const PERKS = [
  { icon: "truck", label: "Free pickup", tint: colors.orange },
  { icon: "clock", label: "48h delivery", tint: colors.navy },
  { icon: "shield", label: "Quality care", tint: "#1F9D3A" },
] as const;

const styles = StyleSheet.create({
  perks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    gap: 7,
    marginTop: 2,
    marginBottom: space.lg + 6,
    paddingHorizontal: 4,
  },
  perk: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  perkText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    letterSpacing: -0.2,
    color: colors.inkSoft,
  },
  perkSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CFC8BA",
  },
  root: { flex: 1, backgroundColor: "#FAF9F6", overflow: "hidden" }, // the profile page's warm white, so the white cards hold their shape
  fill: { width: "100%", height: "100%" },
  flex: { flex: 1 },
  body: { paddingHorizontal: space.lg },
  greeting: {
    marginTop: space.lg,
    marginBottom: space.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
  },
  today: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  todayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#12AD2B",
  },
  todayLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  todayDate: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  hello: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  // the profile page's beige calendar card, with the ironing illustration on the right
  bookingCard: {
    height: 172,
    borderRadius: shape.card,
    backgroundColor: "#F1EDE4",
    borderWidth: 1,
    borderColor: "#E3DDD0", // a thin warm edge, so the white corner doesn't melt into the page
    overflow: "hidden",
    marginBottom: space.xxl,
  },
  // a white disc wide enough to hold the whole illustration, so its own white backdrop never shows an edge
  bookingHalo: {
    position: "absolute",
    right: -44,
    bottom: -58,
    width: 252,
    height: 252,
    borderRadius: 126,
    backgroundColor: "#FFFFFF",
  },
  bookingArt: {
    position: "absolute",
    right: -10,
    bottom: -6,
    height: 152,
    width: 152 * (721 / 586),
    mixBlendMode: "multiply",
  },
  bookingBody: {
    flex: 1,
    justifyContent: "space-between",
    padding: space.lg,
    maxWidth: "58%",
  },
  bookingKicker: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  bookingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
  bookingKickerText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.ink,
  },
  bookingTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  bookingCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#0A1C3E",
  },
  bookingCtaText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  arrowLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EDE4",
    alignItems: "center",
    justifyContent: "center",
  },
  servicesRow: {
    paddingHorizontal: space.lg,
    gap: space.md,
    paddingBottom: space.xl,
  },
  service: {
    width: 156,
    backgroundColor: app.card,
    borderRadius: shape.tile,
    padding: space.sm,
    paddingBottom: space.md,
  },
  serviceArt: {
    height: 124,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: space.md,
  },
  serviceName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  servicePrice: { fontFamily: fonts.semibold, color: colors.ink },
  offers: { marginTop: space.sm },
  referSection: { marginTop: space.xl },
});
