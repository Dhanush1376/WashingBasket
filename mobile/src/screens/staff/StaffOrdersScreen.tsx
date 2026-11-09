import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '../../components/app/Icon';
import { useFocusReplay } from '../../components/app/motion';
import { Pill } from '../../components/app/primitives';
import { EmptyState, Skeleton } from '../../components/app/states';
import { findCustomer } from '../../mock/engine/selectors';
import type { StaffTabProps } from '../../navigation/types';
import { branchOrders, FILTER_LABEL, matchesFilter, ROLE, tasksFor, type OrdersFilter } from '../../staff/work';
import { colors, fonts, space } from '../../theme';
import { CHIP, EDGE, OrderCard, shared, StaffPage, useOrderAction, useStaff, webCursor } from './kit';

const EMPTY: Record<OrdersFilter, { title: string; message: string }> = {
  all: { title: 'No orders yet', message: 'Paid orders for your branch will appear here.' },
  incoming: { title: 'Nothing incoming', message: 'Paid drop-offs and pickups waiting for a QR scan show up here.' },
  assigned: { title: 'Nothing assigned', message: 'Orders your supervisor gives to you appear here.' },
  progress: { title: 'Nothing in progress', message: 'Accepted orders show up here while they’re washed and finished.' },
  ready: { title: 'Nothing ready', message: 'Finished orders waiting for handover appear here.' },
  completed: { title: 'Nothing completed yet', message: 'Delivered and rejected orders are listed here.' },
};

/**
 * Orders at my branch, filtered the way my role works. Each card shows where the order stands and, when it's mine
 * to move, the button for the next step. A search finds an order by its number or the customer's name.
 */
export function StaffOrdersScreen({ navigation, route }: StaffTabProps<'StaffOrders'>) {
  const replay = useFocusReplay();
  const { state, me } = useStaff();
  const role = me ? ROLE[me.staff.role] : null;
  const [filter, setFilter] = useState<OrdersFilter>(route.params?.filter ?? role?.start ?? 'all');
  const [query, setQuery] = useState('');
  const action = useOrderAction(me?.staff.id);

  // a filter passed in (from Home's shortcuts) switches to it
  const param = route.params?.filter;
  const [seen, setSeen] = useState(param);
  if (param !== seen) {
    setSeen(param);
    if (param) setFilter(param);
  }

  const all = useMemo(() => (state && me ? branchOrders(state, me.staff) : []), [state, me]);
  const tasks = useMemo(() => (state && me ? tasksFor(state, me.staff) : []), [state, me]);

  if (!state || !me || !role) {
    return (
      <StaffPage title="Orders">
        <View style={{ gap: space.md }}>
          <Skeleton height={38} width={260} radius={19} />
          <Skeleton height={150} radius={22} />
          <Skeleton height={150} radius={22} />
        </View>
      </StaffPage>
    );
  }
  const filters = role.filters.includes(filter) ? role.filters : [...role.filters, filter];
  const q = query.trim().toLowerCase();
  const shown = all
    .filter((o) => matchesFilter(o, filter, me.staff))
    .filter((o) => !q || o.id.toLowerCase().includes(q) || (findCustomer(state, o.customerId)?.name ?? '').toLowerCase().includes(q))
    // my own next steps first, then the rest by latest activity
    .sort((a, b) => Number(tasks.some((t) => t.order.id === b.id)) - Number(tasks.some((t) => t.order.id === a.id)));
  const due = (id: string) => tasks.find((t) => t.order.id === id);

  return (
    <StaffPage title="Orders" subtitle={`${me.location.shortName} · ${role.title}`}>
      <View style={styles.search}>
        <Icon name="search" size={17} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search order number or customer"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search orders"
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} style={[styles.clear, webCursor]}>
            <Icon name="x" size={14} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} style={styles.pillScroll} accessibilityRole="tablist">
        {filters.map((f) => (
          <Pill key={f} label={FILTER_LABEL[f]} count={all.filter((o) => matchesFilter(o, f, me.staff)).length} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {action.error ? (
        <Text style={shared.error} accessibilityRole="alert">
          {action.error.orderId}: {action.error.message}
        </Text>
      ) : null}

      {shown.length ? (
        <View style={{ gap: space.md }}>
          {shown.map((o, i) => {
            const t = due(o.id);
            return (
              <Animated.View key={`${filter}-${replay}-${o.id}`} entering={FadeInDown.delay(80 + Math.min(i, 8) * 45).duration(340)}>
                <OrderCard order={o} state={state} me={me.staff} due={t?.due} urgent={t?.urgent} busy={action.busy === o.id} onOpen={() => navigation.navigate('StaffOrder', { orderId: o.id })} onAction={(a) => action.run(o, a)} />
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <EmptyState icon={q ? 'search' : 'inbox'} title={q ? 'No matching orders' : EMPTY[filter].title} message={q ? `Nothing at ${me.location.shortName} matches “${query.trim()}”.` : EMPTY[filter].message} />
      )}
    </StaffPage>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.lg, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: EDGE, marginTop: space.sm },
  searchInput: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, paddingVertical: 0, outlineStyle: 'none' } as object,
  clear: { width: 26, height: 26, borderRadius: 13, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' },
  pillScroll: { marginHorizontal: -space.lg, flexGrow: 0 },
  pills: { gap: space.sm, paddingHorizontal: space.lg },
});
