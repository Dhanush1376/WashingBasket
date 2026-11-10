import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { TopBar } from '../../components/app/TopBar';
import { Icon, type IconName } from '../../components/app/Icon';
import { LogoutConfirm } from '../../components/app/LogoutConfirm';
import { Rise, RollingNumber, useFocusReplay } from '../../components/app/motion';
import { Avatar, MenuRow } from '../../components/app/primitives';
import { ORDER_STATUS } from '../../components/app/status';
import { ErrorState, Skeleton } from '../../components/app/states';
import { EVENT_LOOK, LaundryCalendar } from '../../components/profile/LaundryCalendar';
import { GuestProfile } from '../../components/profile/GuestProfile';
import { AddressesDrawer, EditProfileDrawer, type NewAddress } from '../../components/profile/ProfileDrawers';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { useAppUser } from '../../hooks/useAppUser';
import { date, initials, money, time } from '../../lib/format';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { TabProps } from '../../navigation/types';
import { addAddress, listOffers, setDefaultAddress, updateUser } from '../../services/mock/account.service';
import {
  addProfileAddress,
  getCustomerProfile,
  getMembershipDetails,
  getProfileStatistics,
  getSavedAddresses,
  getWalletDetails,
  dayKey as toDayKey,
  setDefaultProfileAddress,
  updateCustomerProfile,
} from '../../services/mock/profile.service';
import { useSession } from '../../session/session';
import { app, brand, brandShades, colors, fonts, space } from '../../theme';
import type { LaundryEventDetail } from '../../types/profile';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* Washing Basket's own shades: the logo's navy, orange and the illustrations' yellow, on warm white and beige. */
const BG = '#FAF9F6';
const BEIGE = '#F1EDE4';
const YELLOW = app.yellow;
const RADIUS = 26;
const PAGE = space.lg;

export function ProfileScreen({ navigation }: TabProps<'Profile'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar(); // the top bar slides away as you read down and comes back as you scroll up
  const replay = useFocusReplay(); // the cards rise in one after another every time Profile opens
  const { width } = useWindowDimensions();
  const { guest } = useAppUser();
  const { signOut, completeProfile } = useSession();

  const customer = useQuery(keys.profile, getCustomerProfile);
  const wallet = useQuery(keys.profileWallet, getWalletDetails);
  const stats = useQuery(keys.profileStats, getProfileStatistics);
  const addresses = useQuery(keys.profileAddresses, getSavedAddresses);
  const membership = useQuery(keys.profileMembership, getMembershipDetails);
  const offers = useQuery(keys.offers, listOffers);

  const [addressesOpen, setAddressesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const calendarW = Math.max(260, Math.min(width, 560) - PAGE * 2 - space.lg * 2 - 2);
  const openOrder = (orderId: string) => navigation.navigate('OrderDetail', { orderId });

  if (guest) {
    return <GuestProfile onSignIn={signOut} onHelp={() => navigation.navigate('Support')} />;
  }

  // the same three updates the Edit profile screen makes, so the new name shows everywhere
  const saveProfile = async ({ fullName, email, avatarUrl }: { fullName: string; email: string; avatarUrl?: string }) => {
    await updateUser({ name: fullName, email });
    await updateCustomerProfile({ fullName, email, avatarUrl });
    await completeProfile({ fullName, email });
    invalidate(keys.user, keys.profile);
    setEditOpen(false);
  };

  // saved to both lists, so the rest of the app (booking, home header) sees the new address too
  const addNewAddress = async (input: NewAddress) => {
    const [saved] = await Promise.all([addProfileAddress(input), addAddress(input)]);
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
    return saved;
  };

  const makeDefault = async (id: string) => {
    await Promise.all([setDefaultProfileAddress(id), setDefaultAddress(id)]); // the rest of the app shows the default too
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
  };

  const me = customer.data;
  const defaultAddress = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
  const activeOffers = offers.data?.filter((o) => o.status === 'active') ?? [];
  const heroDiscount = activeOffers.find((o) => o.discountValue && o.discountValue !== 'FREE')?.discountValue ?? '15%';
  const hasFreeDelivery = activeOffers.some((o) => o.code === 'FREEDEL' || o.discountValue === 'FREE');
  const pillText = hasFreeDelivery ? '+Free delivery' : `${activeOffers.length} available`;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={[styles.page, { paddingTop: bar.height + space.xs, paddingBottom: Math.max(insets.bottom, 12) + 64 }]}
        showsVerticalScrollIndicator={false}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── who ── */}
        <Rise replay={replay} delay={40} distance={18} scale={0.97}>
          <View style={styles.profile}>
            {customer.loading ? (
              <View style={styles.idRow}>
                <Skeleton height={68} width={68} radius={34} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skeleton height={20} width={170} radius={8} />
                  <Skeleton height={14} width={120} radius={6} />
                </View>
              </View>
            ) : customer.error || !me ? (
              <ErrorState onRetry={customer.refetch} />
            ) : (
              <>
                <View style={styles.idRow}>
                  {/* the avatar doubles as the way in to editing */}
                  <Pressable
                    onPress={() => setEditOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                    style={({ pressed }) => [styles.avatarRing, webCursor, pressed && { transform: [{ scale: 0.96 }] }]}
                  >
                    <Avatar name={me.fullName} url={me.avatarUrl} size={64} />
                    <View style={styles.avatarEdit}>
                      <Icon name="edit" size={11} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  </Pressable>

                  {/* a warm hello, the name, and the number in a soft pill */}
                  <View style={styles.idText}>
                    <Text style={styles.hello}>Hello,</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {me.fullName}
                    </Text>
                    <View style={styles.phonePill} accessible accessibilityLabel={`Mobile number ${me.phone}`}>
                      <Icon name="phone" size={12} color={colors.inkSoft} strokeWidth={2.2} />
                      <Text style={styles.phoneText}>{me.phone}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.idRule} />

                <View style={styles.actions}>
                  <QuickAction icon="edit" label="Edit" onPress={() => setEditOpen(true)} />
                  <QuickAction icon="mapPin" label="Addresses" onPress={() => setAddressesOpen(true)} />
                  <QuickAction icon="gift" label="Refer" onPress={() => navigation.navigate('Refer')} />
                  <QuickAction icon="headset" label="Support" onPress={() => navigation.navigate('Support')} />
                </View>
              </>
            )}
          </View>
        </Rise>

        {/* ── row 2: wallet (large) + orders (small) ── */}
        <Rise replay={replay} delay={120} distance={18} scale={0.97} style={styles.row}>
          <Tile onPress={() => navigation.navigate('Wallet')} flex={1.3} style={styles.walletCard} label="Open wallet">
            <View style={styles.walletHead}>
              <View style={styles.tileIcon}>
                <Icon name="wallet" size={18} color={colors.ink} />
              </View>
              <View style={styles.arrowDark}>
                <Icon name="arrowUpRight" size={16} color="#FFFFFF" strokeWidth={2} />
              </View>
            </View>
            <View>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              {wallet.data ? (
                <RollingNumber value={wallet.data.balance} style={styles.walletAmount} delay={200} />
              ) : (
                <Skeleton height={34} width={110} radius={8} style={{ marginTop: 4 }} />
              )}
              {wallet.data?.pending ? (
                <View style={styles.pendingChip}>
                  <Text style={styles.pendingText}>+{money(wallet.data.pending)} pending</Text>
                </View>
              ) : null}
            </View>
          </Tile>

          <Tile onPress={() => navigation.navigate('Orders')} flex={1} style={styles.statsCard} label="Open order history">
            <View style={styles.tileHead}>
              <Text style={styles.cardKicker}>Orders</Text>
              <View style={styles.arrowLight}>
                <Icon name="arrowUpRight" size={16} color={colors.ink} strokeWidth={2} />
              </View>
            </View>
            {stats.data ? (
              <>
                <Text style={styles.statsTotal}>{stats.data.totalOrders}</Text>
                <View style={{ gap: 6 }}>
                  <StatLine color="#62D487" label="Completed" value={stats.data.completedOrders} />
                  <StatLine color="#FFA742" label="Active" value={stats.data.activeOrders} />
                  <StatLine color="#F87C87" label="Cancelled" value={stats.data.cancelledOrders} />
                </View>
              </>
            ) : (
              <Skeleton height={96} radius={12} style={{ marginTop: space.sm }} />
            )}
          </Tile>
        </Rise>

        {/* ── row 3: the laundry calendar ── */}
        <Rise replay={replay} delay={180} distance={18} scale={0.97}>
          <View style={styles.calendarCard}>
            <LaundryCalendar
              width={calendarW}
              renderDay={(key, events, close) => (
                <DaySheet
                  day={key}
                  events={events}
                  onBook={() => {
                    close();
                    navigation.navigate('Book');
                  }}
                  onOpenOrder={(id) => {
                    close();
                    openOrder(id);
                  }}
                />
              )}
            />
          </View>
        </Rise>

        {/* ── row 4: offers & membership ── */}
        <Rise replay={replay} delay={240} distance={18} scale={0.97} style={styles.row}>
          <Tile onPress={() => navigation.navigate('Offers')} flex={1} style={styles.offerCard} label="Open offers and coupons">
            <View style={styles.walletHead}>
              <View style={styles.tileIcon}>
                <Icon name="tag" size={18} color={brand.orange} />
              </View>
              <View style={styles.arrowLight}>
                <Icon name="arrowUpRight" size={16} color={colors.ink} strokeWidth={2} />
              </View>
            </View>
            <View>
              <Text style={styles.offerLabel}>Active offers</Text>
              {offers.loading ? (
                <Skeleton height={32} width={100} radius={8} style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.offerHero}>{heroDiscount} OFF</Text>
                  <View style={styles.offerPill}>
                    <Text style={styles.offerPillText}>{pillText}</Text>
                  </View>
                </>
              )}
            </View>
          </Tile>

          <Tile onPress={() => navigation.navigate('Refer')} flex={1} style={styles.memberCard} label="Open refer and earn">
            <View style={styles.walletHead}>
              <View style={styles.tileIcon}>
                <Icon name="gift" size={18} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={styles.arrowGlass}>
                <Icon name="arrowUpRight" size={16} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </View>
            <View>
              <Text style={styles.memberLabelDark}>Refer & earn</Text>
              {membership.loading || !membership.data ? (
                <Skeleton height={32} width={100} radius={8} style={{ marginTop: 4 }} />
              ) : (
                <>
                  <Text style={styles.memberHeroDark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    Get ₹200
                  </Text>
                  <View style={styles.memberPillDark}>
                    <Text style={styles.memberPillTextDark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                      {membership.data.friendsJoined > 0
                        ? `${membership.data.friendsJoined} joined • ${money(membership.data.rewardsEarned)} earned`
                        : 'Give ₹100, get ₹200'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Tile>
        </Rise>

        {/* ── row 5: account ── */}
        <Rise replay={replay} delay={320} distance={18} scale={0.97}>
          <View style={styles.menuCard}>
            <MenuRow icon="mapPin" label="Saved addresses" onPress={() => setAddressesOpen(true)} />
            <MenuRow divider icon="gift" label="Refer & earn" onPress={() => navigation.navigate('Refer')} />
            <MenuRow divider icon="headset" label="Help & support" onPress={() => navigation.navigate('Support')} />
            <MenuRow divider icon="logout" label="Log out" danger onPress={() => setConfirmLogout(true)} />
          </View>
        </Rise>
      </Animated.ScrollView>

      {/* ── header: over the page, frosted once the page moves under it ── */}
      <CollapsingBar bar={bar} style={{ paddingTop: Math.max(insets.top, 6) }}>
        <View style={styles.barInner}>
          <TopBar padded={false} title="Profile" />
        </View>
      </CollapsingBar>

      {/* the laundry that happened on the chosen day */}

      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)}>
        {me ? <EditProfileDrawer customer={me} onSave={saveProfile} /> : null}
      </BottomSheet>

      <BottomSheet visible={addressesOpen} onClose={() => setAddressesOpen(false)}>
        {addresses.data ? (
          <AddressesDrawer
            addresses={addresses.data}
            onMakeDefault={makeDefault}
            onAdd={addNewAddress}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <LogoutConfirm
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            signOut();
          }}
        />
      </BottomSheet>
    </View>
  );
}

/* ───────────── pieces ───────────── */

/** A card that sinks slightly under the finger. */
function Tile({ onPress, flex, style, label, children }: { onPress: () => void; flex?: number; style: object; label: string; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => s.set(withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => s.set(withSpring(1, { damping: 16, stiffness: 260 }))}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[flex ? { flex } : null, webCursor]}
    >
      <Animated.View style={[style, flex ? styles.tileFill : null, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quick, webCursor, pressed && { transform: [{ scale: 0.95 }] }]}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={18} color={colors.ink} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function StatLine({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.statLine}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** Everything that happened on one day, oldest first. */
/**
 * What happened on a date, for the calendar's date card. One row per update: a dot in the step's colour, the step,
 * and its time on the right; then the order on one quiet line; then where the order is now and a link to it.
 */
function DaySheet({
  day,
  events,
  onOpenOrder,
  onBook,
}: {
  day: string;
  events: LaundryEventDetail[];
  onOpenOrder: (id: string) => void;
  onBook: () => void;
}) {
  // a quiet day: in the past it just says so; today or later, it's a free slot you can book
  if (!events.length) {
    const ahead = day >= toDayKey(new Date().toISOString());
    return (
      <View style={styles.dayEmpty}>
        <View style={styles.dayEmptyIcon}>
          <Icon name={ahead ? 'calendar' : 'check'} size={13} color={colors.inkSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayEmptyTitle}>{ahead ? 'Free day' : 'No laundry this day'}</Text>
          <Text style={styles.dayEmptyText}>{ahead ? 'Nothing booked yet.' : 'Nothing was picked up or delivered.'}</Text>
        </View>
        {ahead ? (
          <Pressable
            onPress={onBook}
            accessibilityRole="button"
            accessibilityLabel="Book a pickup"
            hitSlop={8}
            style={({ pressed }) => [styles.dayBook, webCursor, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.dayBookText}>Book</Text>
            <Icon name="arrowRight" size={13} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.dayCardsWrap}>
      {events.map((e, i) => {
        const look = EVENT_LOOK[e.type];
        const isFutureDelivery = e.type === 'scheduled_pickup' && !!e.order?.pickedUpAt;
        const label = isFutureDelivery ? 'Estimated delivery' : look.label;
        const when = e.type === 'scheduled_pickup' && e.until ? `${time(e.at)} – ${time(e.until)}` : time(e.at);
        const status = e.order ? ORDER_STATUS[e.order.status] : null;
        const serviceName = e.order?.service || 'Laundry Service';
        const itemsInfo = e.order?.itemsLabel || '';

        return (
          <Pressable
            key={e.id}
            onPress={() => onOpenOrder(e.orderId)}
            accessibilityRole="button"
            accessibilityLabel={`Order #${e.orderId}, ${label}, ${serviceName}. Tap to view order details`}
            style={({ pressed }) => [
              styles.dayCard,
              i > 0 && { marginTop: 10 },
              Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
              pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
            ]}
          >
            {/* ── Top row: Event badge + dot on left, Time on right ── */}
            <View style={styles.dayTop}>
              <View style={[styles.dayEventBadge, { backgroundColor: (look.tile ?? '#E0F2FE') + '35' }]}>
                <View style={[styles.dayDot, { backgroundColor: look.color }]} />
                <Text style={[styles.dayEventLabel, { color: look.textColor ?? '#0A1C3E' }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <Text style={styles.dayTime}>{when}</Text>
            </View>

            {/* ── Middle: Order number & service with arrow button ── */}
            <View style={styles.dayOrderRow}>
              <View style={styles.dayOrderInfo}>
                <Text style={styles.dayOrderTitle} numberOfLines={1}>
                  Order #{e.orderId}
                </Text>
                <Text style={styles.dayOrderMeta} numberOfLines={1}>
                  {[serviceName, itemsInfo].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.dayArrowCircle}>
                <Icon name="arrowUpRight" size={13.5} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>

            {/* ── Bottom row: Status pill on left, View order prompt on right ── */}
            {status ? (
              <View style={styles.dayFoot}>
                <View style={[styles.dayNow, { backgroundColor: status.tone.bg }]}>
                  <View style={[styles.dayNowDot, { backgroundColor: status.tone.fg }]} />
                  <Text style={[styles.dayNowText, { color: status.tone.fg }]} numberOfLines={1}>
                    {status.label}
                  </Text>
                </View>
                <View style={styles.dayViewLink}>
                  <Text style={styles.dayViewLinkText}>View order</Text>
                  <Icon name="arrowRight" size={11} color={colors.ink} strokeWidth={2.2} />
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(40, 30, 10, 0.06)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 };

// a thin warm edge on the white cards, so they hold their shape on the light background
const hairline = { borderWidth: 1, borderColor: '#E8E4DA' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  barInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  page: { paddingHorizontal: PAGE, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, color: colors.ink },

  profile: { backgroundColor: '#FFFFFF', borderRadius: RADIUS, padding: space.lg, ...soft, ...hairline },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatarRing: { padding: 3, borderRadius: 40, backgroundColor: BEIGE, position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 },
  avatarEdit: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0A1C3E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idText: { flex: 1, alignItems: 'flex-start' },
  hello: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.inkMuted },
  name: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.6, color: colors.ink, marginTop: 1 },
  phonePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#F4F2EE', marginTop: 8 },
  phoneText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  idRule: { height: 1, backgroundColor: '#EFECE6', marginTop: space.lg, marginBottom: space.md },
  actions: { flexDirection: 'row', alignSelf: 'stretch' },
  quick: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },

  row: { flexDirection: 'row', gap: space.md },
  tileFill: { flex: 1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardKicker: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },

  walletCard: { minHeight: 176, borderRadius: RADIUS, backgroundColor: YELLOW, padding: space.lg, justifyContent: 'space-between' },
  walletHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  arrowDark: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  walletLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(10, 28, 62, 0.72)' },
  walletAmount: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'] },
  pendingChip: { alignSelf: 'flex-start', marginTop: 6, height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.55)', justifyContent: 'center' },
  pendingText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink },

  statsCard: { minHeight: 176, borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, justifyContent: 'space-between', ...soft, ...hairline },
  statsTotal: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkSoft },
  statValue: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },

  calendarCard: {
    borderRadius: RADIUS,
    backgroundColor: BEIGE,
    padding: space.lg,
    borderWidth: 1,
    borderColor: '#E6E0D4',
  },

  viewAllText: { fontFamily: fonts.semibold, fontSize: 13, color: brand.navy },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 22, paddingHorizontal: 8, borderRadius: 11 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fonts.semibold, fontSize: 10.5 },

  arrowLight: { width: 32, height: 32, borderRadius: 16, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center' },

  offerCard: { minHeight: 168, borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, justifyContent: 'space-between', ...soft, ...hairline },
  offerLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  offerHero: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: colors.ink, marginTop: 2 },
  offerPill: { alignSelf: 'flex-start', marginTop: 6, height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#F4F2EE', justifyContent: 'center' },
  offerPillText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink },

  memberCard: {
    minHeight: 168,
    borderRadius: RADIUS,
    backgroundColor: brand.navy,
    padding: space.lg,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 16px rgba(1, 62, 134, 0.22)' } as any)
      : {
          shadowColor: brand.navy,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 3,
        }),
  },
  arrowGlass: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberLabelDark: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.72)',
  },
  memberHeroDark: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1,
    color: '#FFFFFF',
    marginTop: 2,
  },
  memberPillDark: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
  },
  memberPillTextDark: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },

  menuCard: { borderRadius: RADIUS, backgroundColor: '#FFFFFF', paddingVertical: space.xs, paddingHorizontal: space.sm, ...soft, ...hairline },

  // the calendar's date card: every line starts on the same edge, just right of the dot
  dayCardsWrap: {
    marginTop: 6,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EFECE6',
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(10, 28, 62, 0.05)',
        } as any)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  dayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayEventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dayEventLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  dayTime: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  dayOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  dayOrderInfo: {
    flex: 1,
    minWidth: 0,
  },
  dayOrderTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  dayOrderMeta: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.inkMuted,
    marginTop: 2,
  },
  dayArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0A1C3E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dayFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F0EA',
    gap: 8,
  },
  dayNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    maxWidth: '68%',
  },
  dayNowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayNowText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  dayViewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  dayViewLinkText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.ink,
  },
  dayEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8F6F1',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    marginTop: 6,
  },
  dayEmptyIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dayEmptyTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  dayEmptyText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  dayBook: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#0A1C3E' },
  dayBookText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFFFFF' },

  sheetButtons: { flexDirection: 'row', gap: space.sm, marginTop: space.xxl },
});
