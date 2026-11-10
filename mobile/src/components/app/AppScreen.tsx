import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useRoute } from '@react-navigation/native';
import React, { useContext } from 'react';
import { KeyboardAvoidingView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { app, space } from '../../theme';
import { CollapsingBar, useCollapsingBar } from './CollapsingBar';
import { TopBar } from './TopBar';
import { FloatingBottomBar, TabKey } from '../navigation/FloatingBottomBar';

type Props = {
  title: string;
  /** No longer shown: the top bar carries just the page's name. Kept so existing screens still compile. */
  subtitle?: string;
  /** Back for pushed screens; 'menu' (tab roots) shows the logo instead, since the menu is always on the right. */
  leading?: 'back' | 'menu';
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Pinned under the content (e.g. a booking summary with its button). */
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  activeTab?: TabKey;
  hideBottomBar?: boolean;
  /** Page colour behind the cards, e.g. Profile's warm white. Defaults to the app canvas. */
  background?: string;
};

/**
 * Frame for every screen in the app: the shared top bar (logo or back, the page's name, notifications and menu), then
 * the content on the warm canvas. Safe-area aware and clear of the tab bar when inside tabs.
 */
export function AppScreen({
  title,
  leading = 'back',
  right,
  children,
  footer,
  scroll = true,
  contentStyle,
  activeTab,
  hideBottomBar = false,
  background,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const route = useRoute();
  const bar = useCollapsingBar();

  // Primary tabs (Book, Orders) are hosted inside MainTabs which already provides its TabBar
  const isTabScreen =
    route.name === 'Book' ||
    route.name === 'Orders' ||
    route.name === 'Home' ||
    route.name === 'Wallet' ||
    route.name === 'Profile' ||
    tabBarHeight > 0;

  const computedActiveTab: TabKey | undefined =
    activeTab ??
    (route.name === 'Orders' || route.name === 'OrderDetail' || route.name === 'LaundryOrder'
      ? 'Orders'
      : route.name === 'Profile' || route.name === 'EditProfile' || route.name === 'AddAddress'
      ? 'Profile'
      : undefined);

  const safeBottom = insets.bottom;
  const bottom = footer ? space.lg : safeBottom + (isTabScreen ? space.xxl : 74);
  const topPad = Math.max(insets.top, 6);
  const header = (
    <TopBar title={title} leading={leading === 'menu' ? 'logo' : leading} actions={right} bell={route.name !== 'Notifications'} style={styles.header} />
  );
  // a scrolling page lays the bar over its content: it slides away as you read down and comes back as you scroll up
  const body = scroll ? (
    <Animated.ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: bar.height + space.xs, paddingBottom: bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={bar.onScroll}
      scrollEventThrottle={16}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, { paddingBottom: bottom }, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, background ? { backgroundColor: background } : null, { paddingTop: scroll ? 0 : topPad }]}>
      {scroll ? null : header}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: safeBottom + space.md + (isTabScreen ? TAB_BAR_SPACE : 0) }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
      {scroll ? (
        <CollapsingBar bar={bar} tint="255, 255, 255" style={{ paddingTop: topPad }}>
          {header}
        </CollapsingBar>
      ) : null}
      {!isTabScreen && !hideBottomBar ? (
        <FloatingBottomBar activeTab={computedActiveTab} />
      ) : null}
    </View>
  );
}

/** Room for the floating tab bar under a pinned footer on tab pages. */
const TAB_BAR_SPACE = 72;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: app.canvas, overflow: 'hidden' },
  flex: { flex: 1 },
  header: { marginBottom: space.sm },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: app.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#14213D',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
});
