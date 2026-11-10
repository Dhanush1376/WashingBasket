import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { EmptyState, Skeleton } from '../../components/app/states';
import { TopBar } from '../../components/app/TopBar';
import { haptic } from '../../lib/haptics';
import { ago } from '../../lib/format';
import { markNotificationsRead } from '../../mock/services/notificationService';
import type { LaundryNotification } from '../../mock/types';
import type { ScreenProps } from '../../navigation/types';
import { colors, fonts, space } from '../../theme';
import { staffFeed, useStaff } from './kit';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const CANVAS = '#EAE6DB';
const INK = '#0A1C3E';
const PAGE = space.lg;

type Look = { icon: IconName; bg: string; fg: string; unreadBg: string; unreadFg: string };
const ORANGE_LOOK: Look = { icon: 'inbox', bg: '#FFF1E0', fg: colors.orange, unreadBg: colors.orange, unreadFg: '#FFFFFF' };
const LOOK: Partial<Record<LaundryNotification['kind'], Look>> = {
  NEW_REQUEST: ORANGE_LOOK,
  VERIFY_CLOTHES: { ...ORANGE_LOOK, icon: 'shirt' },
  DELIVERY_QR_READY: { icon: 'scan', bg: '#EEF3FB', fg: colors.navy, unreadBg: '#1A6EEB', unreadFg: '#FFFFFF' },
  PAYMENT_COMPLETED: { icon: 'wallet', bg: colors.successTint, fg: '#0F8A27', unreadBg: '#12AD2B', unreadFg: '#FFFFFF' },
  ISSUE_REPORTED: { icon: 'alert', bg: '#FDF2F4', fg: colors.danger, unreadBg: colors.danger, unreadFg: '#FFFFFF' },
  ORDER_CANCELLED: { icon: 'x', bg: '#F1F5F9', fg: '#64748B', unreadBg: '#64748B', unreadFg: '#FFFFFF' },
};
const lookFor = (n: LaundryNotification): Look => LOOK[n.kind] ?? { ...ORANGE_LOOK, icon: 'bell' };

function dayGroups(items: LaundryNotification[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const DAY = 86400000;
  const label = (iso: string) => {
    const t = new Date(iso).getTime();
    if (t >= start.getTime()) return 'Today';
    if (t >= start.getTime() - DAY) return 'Yesterday';
    if (t >= start.getTime() - 6 * DAY) return 'This week';
    return 'Earlier';
  };
  const groups: { title: string; items: LaundryNotification[] }[] = [];
  for (const n of items) {
    const title = label(n.createdAt);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(n);
    else groups.push({ title, items: [n] });
  }
  return groups;
}

/**
 * What happened at my branch that needs me, laid out like the customer Notifications page: the orange "Latest" card
 * tucked behind a white sheet that rises to full screen as the list scrolls. Filtered by my notification choices on
 * Profile; opening one marks it read and opens its order. The menu button opens the staff side menu.
 */
export function StaffNotificationsScreen({ navigation }: ScreenProps<'StaffNotifications'>) {
  const insets = useSafeAreaInsets();
  const { state, me, prefs } = useStaff();
  const [busy, setBusy] = useState(false);

  const all = state && me ? staffFeed(state, me.staff, prefs).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60) : [];
  const unread = all.filter((n) => !n.readAt);
  const latest = unread[0] ?? all[0];
  const groups = dayGroups(all);

  const scrollY = useSharedValue(0);
  const onListScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });
  const orangeCardStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    return { transform: [{ translateY: interpolate(y, [0, 36], [0, 42], 'clamp') }], opacity: interpolate(y, [0, 24], [1, 0], 'clamp') };
  });
  const restingTop = Math.max(insets.top, 6) + 104;
  const lift = restingTop - Math.max(insets.top, 0);
  const sheetStyle = useAnimatedStyle(() => {
    const progress = interpolate(Math.max(0, scrollY.value), [0, 60], [0, 1], 'clamp');
    return {
      transform: [{ translateY: -progress * lift }],
      borderTopLeftRadius: interpolate(progress, [0, 1], [28, 0]),
      borderTopRightRadius: interpolate(progress, [0, 1], [28, 0]),
    };
  });
  const handleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    return { opacity: interpolate(y, [0, 30], [1, 0], 'clamp'), transform: [{ scale: interpolate(y, [0, 30], [1, 0.8], 'clamp') }] };
  });

  const open = (n: LaundryNotification) => {
    haptic.tap();
    if (!n.readAt) markNotificationsRead([n.id]).catch(() => {});
    if (n.orderId) navigation.navigate('StaffOrder', { orderId: n.orderId });
  };
  const markAll = async () => {
    if (busy || !unread.length) return;
    setBusy(true);
    try {
      await markNotificationsRead(unread.map((n) => n.id));
      haptic.success();
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* top bar: logo, title, and the side menu */}
      <View style={[styles.page, { paddingTop: Math.max(insets.top, 6) }]}>
        <Rise distance={8}>
          <TopBar padded={false} title="Notifications" bell={false} onHome={() => navigation.navigate('StaffTabs', { screen: 'StaffHome' })} />
        </Rise>
      </View>

      {/* the orange card behind the sheet */}
      <Animated.View style={[styles.orangeCardWrap, { top: Math.max(insets.top, 6) + 68 }, orangeCardStyle]}>
        <View style={styles.orangeCard}>
          <Text style={styles.orangeCardLabel}>{unread.length ? `${unread.length} new` : 'Latest'}</Text>
          <Text style={styles.orangeCardDate}>{latest ? ago(latest.createdAt) : '—'}</Text>
        </View>
      </Animated.View>

      {/* the white sheet, rising to full screen as you scroll */}
      <Animated.View style={[styles.sheet, { top: restingTop, bottom: -lift }, sheetStyle]}>
        <View style={styles.sheetInner}>
          <Animated.View style={[styles.handleHit, handleStyle]}>
            <View style={styles.handle} />
          </Animated.View>

          <View style={styles.sheetHead}>
            <View style={styles.sheetTitleGroup}>
              <Text style={styles.sheetTitle}>All updates</Text>
              <Text style={styles.sheetCount}>{all.length}</Text>
            </View>
            {unread.length > 0 ? (
              <Pressable onPress={markAll} disabled={busy} accessibilityRole="button" accessibilityLabel="Mark all as read" style={({ pressed }) => [styles.markAllBtn, webCursor, (pressed || busy) && { opacity: 0.7 }]}>
                <Icon name="check" size={12} color={INK} strokeWidth={2.6} />
                <Text style={styles.markAllBtnText}>{busy ? 'Marking…' : 'Mark all read'}</Text>
              </Pressable>
            ) : null}
          </View>

          {!state || !me ? (
            <View style={{ paddingHorizontal: PAGE, paddingTop: space.md, gap: 12 }}>
              <Skeleton height={70} radius={16} />
              <Skeleton height={70} radius={16} />
              <Skeleton height={70} radius={16} />
            </View>
          ) : (
            <Animated.ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: PAGE, paddingBottom: Math.max(insets.bottom, 12) + lift + 24 }}
              showsVerticalScrollIndicator={false}
              onScroll={onListScroll}
              scrollEventThrottle={16}
            >
              {!all.length ? (
                <EmptyState icon="bell" title="Nothing here yet" message={`New orders and handovers at ${me.location.shortName} will show up here.`} />
              ) : (
                <Animated.View entering={FadeIn.duration(220)}>
                  {groups.map((g, gIdx) => (
                    <View key={g.title}>
                      <Text style={styles.groupLabel}>{g.title}</Text>
                      {g.items.map((n, i) => (
                        <React.Fragment key={n.id}>
                          <Row n={n} onPress={() => open(n)} />
                          {!(i === g.items.length - 1 && gIdx === groups.length - 1) ? <View style={styles.divider} /> : null}
                        </React.Fragment>
                      ))}
                    </View>
                  ))}
                  <Text style={styles.end}>{"That's everything"}</Text>
                  <Text style={styles.hint}>Choose what you hear about in Profile → Notifications.</Text>
                </Animated.View>
              )}
            </Animated.ScrollView>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function Row({ n, onPress }: { n: LaundryNotification; onPress: () => void }) {
  const look = lookFor(n);
  const read = !!n.readAt;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${read ? '' : 'Unread. '}${n.title}. ${n.body}`} style={({ pressed }) => [styles.row, webCursor, pressed && { opacity: 0.7 }]}>
      <View style={[styles.rowIcon, { backgroundColor: read ? look.bg : look.unreadBg }]}>
        <Icon name={look.icon} size={18} color={read ? look.fg : look.unreadFg} strokeWidth={2.2} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, read && styles.rowTitleRead]} numberOfLines={1}>
          {n.title}
        </Text>
        <Text style={styles.rowText} numberOfLines={2}>
          {n.body}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowTime}>{ago(n.createdAt)}</Text>
        {!read ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CANVAS },
  page: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },

  orangeCardWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1, paddingHorizontal: 14 },
  orangeCard: { width: '100%', maxWidth: 532, height: 60, borderRadius: 22, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 },
  orangeCardLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.2, color: '#FFFFFF' },
  orangeCardDate: { fontFamily: fonts.semibold, fontSize: 11.5, color: 'rgba(255, 255, 255, 0.95)' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#E8E4DA',
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 -6px 24px rgba(10, 28, 62, 0.08)' } as object) : { shadowColor: '#000000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 }),
  },
  sheetInner: { maxWidth: 560, width: '100%', alignSelf: 'center', flex: 1 },
  handleHit: { alignSelf: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D5D9E0' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE, paddingTop: 4, paddingBottom: 10 },
  sheetTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: INK },
  sheetCount: { fontFamily: fonts.bold, fontSize: 12, color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  markAllBtnText: { fontFamily: fonts.bold, fontSize: 11.5, color: INK },

  groupLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#8A8275', marginTop: space.lg, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  divider: { height: 1, backgroundColor: '#E5E7EB', width: '100%' },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: -0.2, color: INK },
  rowTitleRead: { fontFamily: fonts.semibold, color: '#4A433A' },
  rowText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: '#766F64', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', alignSelf: 'flex-start', gap: 6, paddingTop: 3 },
  rowTime: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#8A8275' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  end: { textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#8A8275', marginTop: space.xl },
  hint: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: '#8A8275', marginTop: space.sm, paddingBottom: 24 },
});
