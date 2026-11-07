import React, { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { Rise, useFocusReplay } from '../../components/app/motion';
import { EmptyState, Skeleton } from '../../components/app/states';
import { TopBar } from '../../components/app/TopBar';
import { triggerAppRefresh } from '../../lib/query';
import { haptic } from '../../lib/haptics';
import { LaundryOrderRow } from '../../components/laundry/LaundryOrderRow';
import { useAppUser } from '../../hooks/useAppUser';
import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { isOpen } from '../../mock/engine/lifecycle';
import { findLocation, ordersForCustomer } from '../../mock/engine/selectors';
import type { LaundryOrder } from '../../mock/types';
import type { TabProps } from '../../navigation/types';
import type { OrderFilter } from '../../services/mock/orders.service';
import { colors, space } from '../../theme';

const BG = '#FAF9F6';
const BG_RGB = '250, 249, 246';
const PAGE = space.lg;

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

/** The same filters over the laundry orders placed through New order. */
function laundryMatches(o: LaundryOrder, f: OrderFilter) {
  if (f === 'active') return isOpen(o.status);
  if (f === 'completed') return o.status === 'DELIVERED';
  if (f === 'cancelled') return o.status === 'REJECTED' || o.status === 'CANCELLED';
  return true;
}

/** A one-line nudge on a laundry order that's waiting on the customer. */
function laundryHint(o: LaundryOrder): string | undefined {
  if (o.status === 'PAYMENT_PENDING') return 'Pay to unlock your QR code';
  if (o.status === 'AWAITING_STAFF_ACCEPTANCE') return o.serviceMode === 'HOME_PICKUP' ? 'Show your QR to the pickup partner' : 'Show your QR at the counter';
  if (o.status === 'READY_FOR_DELIVERY') return 'Ready: check your clothes';
  if (o.status === 'AWAITING_CUSTOMER_VERIFICATION') return o.verification ? 'Show your delivery QR' : 'Check your clothes';
  return undefined;
}

const EMPTY: Record<OrderFilter, { title: string; message: string }> = {
  all: { title: 'No orders yet', message: 'Book your first pickup and your orders will appear here.' },
  active: { title: 'Nothing in progress', message: 'Orders being collected, cleaned or delivered show up here.' },
  completed: { title: 'No completed orders', message: 'Delivered orders will be listed here.' },
  cancelled: { title: 'No cancelled orders', message: 'Good news — nothing has been cancelled.' },
};

/**
 * My orders: simple, clean overview of laundry orders.
 */
export function OrdersScreen({ navigation, route }: TabProps<'Orders'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const replay = useFocusReplay();
  const { guest } = useAppUser();
  const [filter, setFilter] = useState<OrderFilter>(route.params?.filter ?? 'all');
  const state = useLaundryState();
  const customer = useCurrentCustomer();

  // User-owned orders or all state orders
  const userOrders = state && customer && !guest ? ordersForCustomer(state, customer.id) : [];
  const ordersPool = userOrders.length > 0 ? userOrders : (state?.orders ?? []);

  // Status filtering
  const laundryShown = ordersPool.filter((o) => laundryMatches(o, filter));
  const empty = !laundryShown.length;

  // a new filter passed in (e.g. Home's "N done" chip) switches to it
  const param = route.params?.filter;
  const [seenParam, setSeenParam] = useState(param);
  if (param !== seenParam) {
    setSeenParam(param);
    if (param) setFilter(param);
  }

  const [pullRefreshing, setPullRefreshing] = useState(false);
  const handlePullRefresh = async () => {
    setPullRefreshing(true);
    haptic.tap();
    await triggerAppRefresh();
    setPullRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: bar.height + space.sm, paddingBottom: Math.max(insets.bottom, 12) + 64 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={colors.orange}
            colors={[colors.orange, colors.navy]}
          />
        }
      >
        <Rise replay={replay} delay={60} distance={18} style={styles.page}>
          {!state ? (
            <View style={{ gap: space.md }}>
              <Skeleton height={112} radius={22} />
              <Skeleton height={112} radius={22} />
            </View>
          ) : empty ? (
            <EmptyState
              icon="bag"
              title={EMPTY[filter].title}
              message={EMPTY[filter].message}
              action={
                filter === 'all' || filter === 'active'
                  ? { label: 'Start an order', onPress: () => navigation.navigate('Book') }
                  : undefined
              }
            />
          ) : (
            <View style={{ gap: space.md }}>
              {laundryShown.map((o, i) => (
                <Animated.View
                  key={`${filter}-${replay}-${o.id}`}
                  entering={FadeInDown.delay(180 + i * 50).duration(380)}
                >
                  <LaundryOrderRow
                    order={o}
                    index={i}
                    location={state ? findLocation(state, o.locationId) : undefined}
                    hint={laundryHint(o)}
                    onPress={() => navigation.navigate('LaundryOrder', { orderId: o.id })}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </Rise>
      </Animated.ScrollView>

      <CollapsingBar bar={bar} tint={BG_RGB} style={{ paddingTop: Math.max(insets.top, 6), paddingBottom: space.sm }}>
        <View style={styles.barInner}>
          <TopBar padded={false} title="My orders" />
        </View>
      </CollapsingBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  barInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  scrollContent: { flexGrow: 1 },
  page: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center', gap: space.md },
});
