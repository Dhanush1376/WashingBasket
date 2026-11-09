import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptic } from '../../lib/haptics';
import { keys, useQuery } from '../../lib/query';
import { useDrawer } from '../../navigation/AppDrawer';
import type { RootStackParamList } from '../../navigation/types';
import { listNotifications } from '../../services/mock/engagement.service';
import { colors, fonts, space } from '../../theme';
import { WashingBasketLogo } from '../logo/WashingBasketLogo';
import { Icon, type IconName } from './Icon';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

type Props = {
  /** The page's name ("Wallet"), or on Home the pickup address. A node lets part of it be lighter. */
  title: React.ReactNode;
  /** Plain-text version of the title, for screen readers, when the title is a node. */
  titleLabel?: string;
  /** A small line above the title. Only Home uses it ("Pickup at"); every other page shows just its name. */
  eyebrow?: string;
  subtitle?: React.ReactNode;
  /** A small status dot before the eyebrow. */
  dot?: string;
  /** Makes the title a button, with a chevron and a soft tint under the finger. */
  onPressTitle?: () => void;
  /** 'logo' on the main pages; 'back' on pages you open from somewhere, so there's always a way back. */
  leading?: 'logo' | 'back';
  /** Overrides where back goes (default: the previous page, or Home). */
  onBack?: () => void;
  /** Extra controls placed before the bell, e.g. "Mark all read". */
  actions?: React.ReactNode;
  /** Hides the bell (on the Notifications page itself). */
  bell?: boolean;
  /** Adds the page's side padding (off when the parent already pads). */
  padded?: boolean;
  /** Where the logo goes (default: the customer Home tab). The staff app passes its own. */
  onHome?: () => void;
  /** Overrides the bell: where it opens and its unread count (default: the customer's notifications). */
  onBell?: () => void;
  unread?: number;
  /** Replaces the menu button at the far right (the staff app shows the person's avatar there). */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's one top bar, on every page: the logo mark (or a back button), a hairline, the page's name, and two round
 * buttons on the right, notifications (with an unread dot) and the menu.
 */
export function TopBar({ title, titleLabel, eyebrow, subtitle, dot, onPressTitle, leading = 'logo', onBack, actions, bell = true, padded = true, style, onHome, onBell, unread: unreadOverride, trailing }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const drawer = useDrawer();
  const notifications = useQuery(keys.notifications, listNotifications);
  const unread = unreadOverride ?? notifications.data?.filter((n) => !n.read).length ?? 0;
  const plain = titleLabel ?? (typeof title === 'string' ? title : '');

  const goHome = () => {
    haptic.tap();
    if (onHome) onHome();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  const body = (
    <>
      {eyebrow ? (
        <View style={styles.eyebrowRow}>
          {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
      ) : null}
      <View style={styles.titleRow}>
        {dot && !eyebrow ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
        <Text style={[styles.title, !eyebrow && !subtitle && styles.titleSolo]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {onPressTitle ? <Icon name="chevronDown" size={14} color={colors.ink} strokeWidth={2.4} /> : null}
      </View>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={[styles.bar, padded && styles.padded, style]}>
      {leading === 'back' ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            if (onBack) onBack();
            else if (navigation.canGoBack()) navigation.goBack();
            else if (onHome) onHome();
            else navigation.navigate('Main', { screen: 'Orders' });
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [styles.mark, webCursor, pressed && { opacity: 0.75 }]}
        >
          <Icon name="chevronLeft" size={22} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
      ) : (
        <Pressable
          onPress={goHome}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Washing Basket Home"
          style={({ pressed }) => [styles.mark, webCursor, pressed && { opacity: 0.75 }]}
        >
          <WashingBasketLogo width={44} shine={false} />
        </Pressable>
      )}
      <View style={styles.rule} />

      {onPressTitle ? (
        <Pressable
          onPress={onPressTitle}
          accessibilityRole="button"
          accessibilityLabel={`${eyebrow ? `${eyebrow}: ` : ''}${plain}. Change`}
          style={({ pressed }) => [styles.main, webCursor, pressed && { opacity: 0.75 }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.main}>{body}</View>
      )}

      <View style={styles.actions}>
        {actions}
        {bell ? <RoundButton icon="bell" label="Notifications" badge={unread} onPress={onBell ?? (() => navigation.navigate('Notifications'))} /> : null}
        {trailing ?? <RoundButton icon="menu" label="Open menu" onPress={drawer.toggle} />}
      </View>
    </View>
  );
}

/** A round white button with a hairline edge; it dips a touch under the finger. Shows an unread dot when asked. */
function RoundButton({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={4}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.btn,
        webCursor,
        hovered && styles.btnHover,
        pressed && styles.btnPressed,
      ]}
    >
      <Icon name={icon} size={19} color={colors.ink} strokeWidth={1.9} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(40, 30, 10, 0.05)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 };

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  padded: { paddingHorizontal: space.lg },
  mark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rule: { width: StyleSheet.hairlineWidth * 2, height: 22, backgroundColor: 'rgba(60, 45, 20, 0.14)' },

  main: { flex: 1, minWidth: 0, justifyContent: 'center', height: 46 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  eyebrow: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 14, color: colors.inkMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 18, letterSpacing: -0.2, color: colors.ink },
  titleSolo: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, marginTop: 0 },
  subtitle: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 1 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    alignItems: 'center',
    justifyContent: 'center',
    ...soft,
  },
  btnHover: { borderColor: '#D9D3C6' },
  btnPressed: { transform: [{ scale: 0.94 }], backgroundColor: '#F6F4EF' },
  badge: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 2, borderColor: '#FFFFFF' },
});

/** Lighter part of a title, e.g. the street after "Home". */
export const titleSubStyle = { fontFamily: fonts.regular, color: colors.inkSoft } as const;
