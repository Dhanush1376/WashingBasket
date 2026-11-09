import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../components/app/Icon';
import { LogoutConfirm } from '../components/app/LogoutConfirm';
import { WashingBasketLogo } from '../components/logo/WashingBasketLogo';
import { StaggeredMenu, StaggeredMenuItem } from '../components/navigation/StaggeredMenu';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useAppUser } from '../hooks/useAppUser';
import { useSession } from '../session/session';
import { fonts, space } from '../theme';
import { navigationRef } from './ref';
import type { MainTabParamList, RootStackParamList, StaffTabParamList } from './types';

type Ctx = { open: () => void; close: () => void; toggle: () => void; isOpen: boolean };
const DrawerContext = createContext<Ctx>({ open: () => {}, close: () => {}, toggle: () => {}, isOpen: false });
export const useDrawer = () => useContext(DrawerContext);

type Destination = {
  label: string;
  icon: IconName;
  /** A root screen, or a tab inside Main. */
  go: { screen: keyof RootStackParamList } | { tab: keyof MainTabParamList } | { staffTab: keyof StaffTabParamList };
};

const DESTINATIONS: Destination[] = [
  { label: 'Home', icon: 'home', go: { tab: 'Home' } },
  { label: 'New order', icon: 'plus', go: { tab: 'Book' } },
  { label: 'My Orders', icon: 'bag', go: { tab: 'Orders' } },
  { label: 'Wallet', icon: 'wallet', go: { tab: 'Wallet' } },
  { label: 'Offers', icon: 'tag', go: { screen: 'Offers' } },
  { label: 'Refer & Earn', icon: 'gift', go: { screen: 'Refer' } },
  { label: 'Price List', icon: 'list', go: { screen: 'PriceList' } },
  { label: 'Support', icon: 'headset', go: { screen: 'Support' } },
];

/** The staff app's menu: its tabs plus the pages that live outside them. */
const STAFF_DESTINATIONS: Destination[] = [
  { label: 'Home', icon: 'home', go: { staffTab: 'StaffHome' } },
  { label: 'Wallet', icon: 'wallet', go: { staffTab: 'StaffSalary' } },
  { label: 'Scan', icon: 'scan', go: { staffTab: 'StaffScan' } },
  { label: 'Notifications', icon: 'bell', go: { screen: 'StaffNotifications' } },
  { label: 'Support', icon: 'headset', go: { staffTab: 'StaffSupport' } },
  { label: 'Profile', icon: 'user', go: { staffTab: 'StaffProfile' } },
];

/** Staff see the staff menu; everyone else the customer one. */
function useDestinations() {
  const { session } = useSession();
  return session?.role === 'staff' ? STAFF_DESTINATIONS : DESTINATIONS;
}
const destKey = (d: Destination) => ('tab' in d.go ? d.go.tab : 'staffTab' in d.go ? d.go.staffTab : d.go.screen);
function navigateTo(d: Destination) {
  if (!navigationRef.isReady()) return;
  if ('tab' in d.go) navigationRef.navigate('Main', { screen: d.go.tab });
  else if ('staffTab' in d.go) navigationRef.navigate('StaffTabs', { screen: d.go.staffTab } as never);
  else navigationRef.navigate(d.go.screen as never);
}

const OUT_MS = 380;

/** Side drawer for the signed-in app: StaggeredMenu with GSAP on web, the same design drawn with Reanimated on phones. */
export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Opening timeline, 0 → 1 (phones). */
  const t = useSharedValue(0);
  /** Closing slide, 0 → 1 (phones). */
  const exit = useSharedValue(0);

  const open = useCallback(() => {
    setMounted(true);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => {
    setVisible((v) => {
      if (!v) setMounted(true);
      return !v;
    });
  }, []);

  useEffect(() => {
    if (visible) {
      // the timeline runs evenly; each part applies its own easing (see DrawerPanel)
      exit.value = 0;
      t.value = 0;
      t.value = withTiming(1, { duration: SHOW_MS, easing: Easing.linear });
      return;
    }
    if (!mounted) return;
    exit.value = withTiming(1, { duration: OUT_MS, easing: Easing.inOut(Easing.cubic) });
    const id = setTimeout(() => setMounted(false), OUT_MS + 30);
    return () => clearTimeout(id);
  }, [visible, mounted, t, exit]);

  // Android back closes the drawer first
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  const value = useMemo(() => ({ open, close, toggle, isOpen: visible }), [open, close, toggle, visible]);
  return (
    <DrawerContext.Provider value={value}>
      {children}
      {Platform.OS === 'web' ? (
        <WebStaggeredDrawer visible={visible} onClose={close} />
      ) : mounted ? (
        <DrawerPanel progress={t} exit={exit} onClose={close} />
      ) : null}
    </DrawerContext.Provider>
  );
}

/** Web-optimized React Bits <StaggeredMenu /> integration with GSAP animations & brand colors */
function WebStaggeredDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const active = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
  const { guest } = useAppUser();
  const { signOut } = useSession();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const go = (d: Destination) => {
    onClose();
    navigateTo(d);
  };

  const isActive = (d: Destination) => destKey(d) === active;
  const destinations = useDestinations();

  const menuItems: StaggeredMenuItem[] = useMemo(() => {
    const list: StaggeredMenuItem[] = destinations.map((d) => ({
      label: d.label,
      active: isActive(d),
      icon: <Icon name={d.icon} size={22} color={isActive(d) ? '#FE8701' : '#1F2430'} strokeWidth={2} />,
      onClick: () => go(d),
    }));

    list.push({
      label: guest ? 'Sign in' : 'Log out',
      dividerBefore: true,
      isDanger: !guest,
      icon: (
        <Icon
          name={guest ? 'user' : 'logout'}
          size={19}
          color={guest ? '#1F2430' : '#D30D24'}
          strokeWidth={2}
        />
      ),
      onClick: () => {
        if (guest) {
          onClose();
          signOut();
        } else {
          setConfirmLogout(true);
        }
      },
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, guest, destinations]);

  return (
    <>
      <StaggeredMenu
        position="left"
        items={menuItems}
        isOpen={visible}
        colors={['#FE8701', '#013E86']}
        accentColor="#FE8701"
        logoComponent={<WashingBasketLogo width={48} shine={false} />}
        brandTitle={
          <span className="sm-panel-brand-lockup">
            <span className="sm-panel-brand-title">
              <span className="sm-panel-brand-cap">W</span>ashing<span className="sm-panel-brand-cap">B</span>asket
            </span>
          </span>
        }
        onMenuClose={onClose}
        isFixed={true}
      />

      <BottomSheet visible={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <LogoutConfirm
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            onClose();
            signOut();
          }}
        />
      </BottomSheet>
    </>
  );
}

/* ───────────── Phones (iOS & Android) ─────────────
 * The same menu as on the web (StaggeredMenu): a white panel led in by an orange and a navy layer,
 * the logo and wordmark with a round close button, bold items that rise in one after another
 * (the current page in orange), and Log out under a divider. Drawn with Reanimated.
 */

/** The opening plays out over this time; each part takes its own slice of it. */
const SHOW_MS = 900;
/** Panel width, as on the web: clamp(260px, 75vw, 340px). */
const panelWidth = (w: number) => Math.min(Math.max(260, w * 0.75), 340);
const LAYERS = ['#FE8701', '#013E86'];
const INK = '#0A1C3E';
const ACCENT = '#FE8701';
const DANGER = '#D30D24';
const HAIRLINE = '#EAE6DB';

/** GSAP's power4.out, as a worklet: quick start, long soft settle. */
function power4Out(x: number) {
  'worklet';
  return 1 - Math.pow(1 - x, 4);
}
/** 0 → 1 between two moments of the opening (in ms), eased. */
function phase(t: number, fromMs: number, toMs: number) {
  'worklet';
  const x = (t * SHOW_MS - fromMs) / (toMs - fromMs);
  return power4Out(Math.min(1, Math.max(0, x)));
}

type MenuItem = { key: string; label: string; icon: IconName; on: boolean; danger?: boolean; divider?: boolean; onPress: () => void };

function DrawerPanel({
  progress,
  exit,
  onClose,
}: {
  progress: SharedValue<number>;
  exit: SharedValue<number>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = panelWidth(width);
  const compact = width <= 640;
  const { guest } = useAppUser();
  const { signOut } = useSession();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const active = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;

  const go = (d: Destination) => {
    onClose();
    navigateTo(d);
  };
  const isActive = (d: Destination) => destKey(d) === active;
  const destinations = useDestinations();

  // the backdrop fades in with the panel and out as everything slides away
  const backdrop = useAnimatedStyle(() => ({ opacity: phase(progress.value, 0, 300) * (1 - exit.value) }));
  // closing: everything leaves together, like the web's single quick slide
  const whole = useAnimatedStyle(() => ({ transform: [{ translateX: -exit.value * (panelW + 40) }] }));
  const layer0 = useAnimatedStyle(() => ({ transform: [{ translateX: (phase(progress.value, 0, 450) - 1) * panelW }] }));
  const layer1 = useAnimatedStyle(() => ({ transform: [{ translateX: (phase(progress.value, 60, 510) - 1) * panelW }] }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (phase(progress.value, 130, 710) - 1) * (panelW + 24) }] }));
  const header = useAnimatedStyle(() => {
    const e = phase(progress.value, 190, 590);
    return { opacity: e, transform: [{ translateY: (1 - e) * -10 }] };
  });

  const items: MenuItem[] = [
    ...destinations.map((d) => ({ key: d.label, label: d.label, icon: d.icon, on: isActive(d), onPress: () => go(d) })),
    {
      key: 'account',
      label: guest ? 'Sign in' : 'Log out',
      icon: guest ? 'user' : 'logout',
      on: false,
      danger: !guest,
      divider: true,
      onPress: () => {
        if (guest) {
          onClose();
          signOut();
        } else setConfirmLogout(true);
      },
    },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View style={[styles.stack, { width: panelW }, whole]} pointerEvents="box-none">
        {LAYERS.map((c, i) => (
          <Animated.View key={c} style={[StyleSheet.absoluteFill, { backgroundColor: c }, i === 0 ? layer0 : layer1]} pointerEvents="none" />
        ))}

        <Animated.View
          style={[styles.panel, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, paddingHorizontal: compact ? 18 : 21 }, panel]}
          accessibilityViewIsModal
        >
          <Animated.View style={[styles.top, header]}>
            <View style={styles.brand}>
              <WashingBasketLogo width={48} shine={false} />
              <Text style={styles.brandTitle} accessibilityRole="header" accessibilityLabel="Washing Basket">
                <Text style={styles.brandCap}>W</Text>ashing<Text style={styles.brandCap}>B</Text>asket
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Icon name="x" size={16} color={INK} strokeWidth={2.4} />
            </Pressable>
          </Animated.View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} bounces={false}>
            {items.map((it, i) => (
              <MenuRow key={it.key} index={i} progress={progress} compact={compact} item={it} />
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <BottomSheet visible={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <LogoutConfirm
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            onClose();
            signOut();
          }}
        />
      </BottomSheet>
    </View>
  );
}

/** One item: rises from below its own line with a slight tilt, a beat after the one above. */
function MenuRow({ index, progress, compact, item }: { index: number; progress: SharedValue<number>; compact: boolean; item: MenuItem }) {
  const rise = useAnimatedStyle(() => {
    const from = 210 + index * 40;
    const e = phase(progress.value, from, from + 380);
    return { transform: [{ translateY: (1 - e) * 34 }, { rotate: `${(1 - e) * 8}deg` }] };
  });
  return (
    <View style={[styles.rowWrap, item.divider && styles.rowDivider]}>
      <Pressable onPress={item.onPress} accessibilityRole="button" accessibilityState={{ selected: item.on }} accessibilityLabel={item.label}>
        {({ pressed }) => {
          const label = item.on || (pressed && !item.danger) ? ACCENT : pressed ? DANGER : INK;
          const icon = item.danger ? DANGER : item.on || pressed ? ACCENT : '#1F2430';
          return (
            <Animated.View style={[styles.row, rise]}>
              <View style={styles.rowIcon}>
                <Icon name={item.icon} size={22} strokeWidth={2} color={icon} />
              </View>
              <Text style={[styles.rowText, compact && styles.rowTextCompact, { color: label }]}>{item.label}</Text>
            </Animated.View>
          );
        }}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(11, 18, 32, 0.45)' },
  stack: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  panel: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  brandTitle: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.35, color: INK },
  brandCap: { fontFamily: fonts.display, fontSize: 23, lineHeight: 24, color: INK },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14213D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  closeBtnPressed: { backgroundColor: '#F1EDE4', transform: [{ scale: 0.95 }] },
  list: { gap: 2, paddingBottom: 8 },
  rowWrap: { overflow: 'hidden' },
  rowDivider: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: HAIRLINE },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, paddingHorizontal: 4, transformOrigin: 'center bottom' },
  rowIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  rowTextCompact: { fontSize: 19, lineHeight: 24 },
  sheetButtons: { flexDirection: 'row', gap: space.md, marginTop: space.xxl },
});
