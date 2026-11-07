import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../components/app/Icon';
import { Avatar, Button } from '../components/app/primitives';
import { WashingBasketLogo } from '../components/logo/WashingBasketLogo';
import { StaggeredMenu, StaggeredMenuItem } from '../components/navigation/StaggeredMenu';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useAppUser } from '../hooks/useAppUser';
import { useSession } from '../session/session';
import { app, colors, fonts, space, text } from '../theme';
import { navigationRef } from './ref';
import type { MainTabParamList, RootStackParamList } from './types';

type Ctx = { open: () => void; close: () => void; toggle: () => void; isOpen: boolean };
const DrawerContext = createContext<Ctx>({ open: () => {}, close: () => {}, toggle: () => {}, isOpen: false });
export const useDrawer = () => useContext(DrawerContext);

type Destination = {
  label: string;
  icon: IconName;
  /** A root screen, or a tab inside Main. */
  go: { screen: keyof RootStackParamList } | { tab: keyof MainTabParamList };
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

const IN_MS = 380;
const OUT_MS = 280;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Side drawer for the signed-in app: StaggeredMenu with GSAP on web, Reanimated on native. */
export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const t = useSharedValue(0);

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
      t.value = withTiming(1, { duration: IN_MS, easing: EASE });
      return;
    }
    if (!mounted) return;
    t.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.cubic) });
    const id = setTimeout(() => setMounted(false), OUT_MS + 30);
    return () => clearTimeout(id);
  }, [visible, mounted, t]);

  // Android back closes the drawer first
  useEffect(() => {
    if (!visible) return;
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
        <DrawerPanel progress={t} onClose={close} />
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
    if (!navigationRef.isReady()) return;
    if ('tab' in d.go) navigationRef.navigate('Main', { screen: d.go.tab });
    else navigationRef.navigate(d.go.screen as never);
  };

  const isActive = (d: Destination) => ('tab' in d.go ? d.go.tab : d.go.screen) === active;

  const menuItems: StaggeredMenuItem[] = useMemo(() => {
    const list: StaggeredMenuItem[] = DESTINATIONS.map((d) => ({
      label: d.label,
      active: isActive(d),
      icon: <Icon name={d.icon} size={19} color={isActive(d) ? '#FE8701' : '#1F2430'} strokeWidth={2} />,
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
  }, [active, guest]);

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
        <Text style={text.h1}>Log out of Washing Basket?</Text>
        <Text style={[text.body, { marginTop: 4 }]} numberOfLines={1}>
          You&apos;ll need your phone to sign back in.
        </Text>
        <View style={styles.sheetButtons}>
          <Button
            label="Cancel"
            variant="outline"
            onPress={() => setConfirmLogout(false)}
            style={{ flex: 1 }}
          />
          <Button
            label="Log out"
            variant="dark"
            onPress={() => {
              setConfirmLogout(false);
              onClose();
              signOut();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </BottomSheet>
    </>
  );
}

/** Native fallback for Android & iOS using react-native-reanimated */
function DrawerPanel({
  progress,
  onClose,
}: {
  progress: ReturnType<typeof useSharedValue<number>>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(width * 0.82, 320);
  const { name, phone, guest } = useAppUser();
  const { signOut } = useSession();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const active = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * (panelW + 24) }],
  }));

  const go = (d: Destination) => {
    onClose();
    if (!navigationRef.isReady()) return;
    if ('tab' in d.go) navigationRef.navigate('Main', { screen: d.go.tab });
    else navigationRef.navigate(d.go.screen as never);
  };

  const isActive = (d: Destination) => ('tab' in d.go ? d.go.tab : d.go.screen) === active;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close menu"
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelW,
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + space.lg,
          },
          panel,
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.top}>
          <View style={styles.logoTile}>
            <WashingBasketLogo width={42} />
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close menu"
            style={styles.closeBtn}
          >
            <Icon name="x" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.profile}>
          <Avatar name={guest ? 'Guest' : name || 'You'} size={48} tone="navy" />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {guest ? 'Guest' : name}
            </Text>
            <Text style={styles.phone}>
              {guest ? 'Browsing without an account' : phone}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: space.sm }}
          showsVerticalScrollIndicator={false}
        >
          {DESTINATIONS.map((d) => {
            const on = isActive(d);
            return (
              <Pressable
                key={d.label}
                onPress={() => go(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.item,
                  on && styles.itemOn,
                  pressed && !on && styles.itemPressed,
                ]}
              >
                <Icon
                  name={d.icon}
                  size={20}
                  color={on ? colors.orange : 'rgba(255,255,255,0.78)'}
                />
                <Text style={[styles.itemText, on && styles.itemTextOn]}>
                  {d.label}
                </Text>
                {on ? <View style={styles.activeDot} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => (guest ? signOut() : setConfirmLogout(true))}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.logout,
            guest && styles.signIn,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Icon
            name={guest ? 'user' : 'logout'}
            size={19}
            color={guest ? colors.ink : '#FFFFFF'}
          />
          <Text style={[styles.logoutText, guest && { color: colors.ink }]}>
            {guest ? 'Sign in' : 'Log out'}
          </Text>
        </Pressable>
      </Animated.View>

      <BottomSheet visible={confirmLogout} onClose={() => setConfirmLogout(false)}>
        <Text style={text.h1}>Log out of Washing Basket?</Text>
        <Text style={[text.body, { marginTop: 4 }]} numberOfLines={1}>
          You&apos;ll need your phone to sign back in.
        </Text>
        <View style={styles.sheetButtons}>
          <Button
            label="Cancel"
            variant="outline"
            onPress={() => setConfirmLogout(false)}
            style={{ flex: 1 }}
          />
          <Button
            label="Log out"
            variant="dark"
            onPress={() => {
              setConfirmLogout(false);
              onClose();
              signOut();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#0B1220' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: app.navyDeep,
    paddingHorizontal: space.lg,
    ...(Platform.OS === 'web' ? ({ boxShadow: '12px 0 40px rgba(0,0,0,0.25)' } as object) : {}),
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  logoTile: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' },
  phone: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 48, paddingHorizontal: space.md, borderRadius: 16 },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.1)' },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  itemText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.82)' },
  itemTextOn: { color: '#FFFFFF', fontFamily: fonts.semibold },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: space.sm,
  },
  signIn: { backgroundColor: '#FFFFFF' },
  logoutText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },
  sheetButtons: { flexDirection: 'row', gap: space.md, marginTop: space.xxl },
});
