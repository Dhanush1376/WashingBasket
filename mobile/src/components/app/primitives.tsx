import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { haptic } from '../../lib/haptics';
import { initials } from '../../lib/format';
import { app, colors, fonts, shape, space, text } from '../../theme';
import { Icon, IconName } from './Icon';
import type { Tone } from './status';

const pressFeedback = { transform: [{ scale: 0.98 }], opacity: 0.94 };
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* ─────────────── Card ─────────────── */

export type CardTone = 'white' | 'cream' | 'navy' | 'yellow' | 'orange';
const CARD_BG: Record<CardTone, string> = {
  white: app.card,
  cream: app.cream,
  navy: app.navyDeep,
  yellow: app.yellow,
  orange: colors.orange,
};

type CardProps = {
  tone?: CardTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  accessibilityLabel?: string;
};

/** Rounded modular surface. Organised by colour and spacing, not borders. */
export function Card({ tone = 'white', onPress, style, children, accessibilityLabel }: CardProps) {
  const base = [styles.card, { backgroundColor: CARD_BG[tone] }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, webCursor, pressed && pressFeedback]}
    >
      {children}
    </Pressable>
  );
}

/* ─────────────── Round icon button ─────────────── */

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'white' | 'dark' | 'orange' | 'glass' | 'cream' | 'stone';
  size?: number;
  badge?: number;
};

const ICON_TONE = {
  white: { bg: app.card, fg: colors.ink },
  stone: { bg: '#F3F0E8', fg: '#0A1C3E' }, // for warm beige pages: sits in the background instead of on it
  cream: { bg: app.cream, fg: colors.ink },
  dark: { bg: '#0A1C3E', fg: '#FFFFFF' },
  orange: { bg: colors.orange, fg: '#FFFFFF' },
  glass: { bg: 'rgba(255,255,255,0.14)', fg: '#FFFFFF' },
} as const;

/** Floating circular control, as in the reference: back, menu, notifications, "open" arrows. */
export function IconButton({ icon, onPress, label, tone = 'white', size = 44, badge }: IconButtonProps) {
  const t = ICON_TONE[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg },
        tone === 'stone' && styles.iconBtnStone,
        webCursor,
        pressed && pressFeedback,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={t.fg} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ─────────────── Pill filter ─────────────── */

export function Pill({
  label,
  selected,
  onPress,
  count,
  style,
  textStyle,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.pill, selected && styles.pillOn, webCursor, style, pressed && !selected && { opacity: 0.8 }]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextOn, textStyle]} numberOfLines={1}>
        {label}
        {count !== undefined ? <Text style={[styles.pillCount, selected && styles.pillTextOn]}>{`  ${count}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

/* ─────────────── Status badge ─────────────── */

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <View style={[styles.status, { backgroundColor: tone.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.statusText, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

/* ─────────────── Section header ─────────────── */

export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <Text style={text.h2} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`${action}: ${title}`}
          style={({ pressed }) => [styles.sectionLink, webCursor, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.sectionAction}>{action}</Text>
          <Icon name="arrowRight" size={14} color={colors.navy} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─────────────── Button ─────────────── */

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'dark' | 'light' | 'outline';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Label on the left, the icon (an arrow by default) in a white circle at the right end. */
  arrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Blend a colour towards white: a faded but solid version of it, so whatever sits behind never shows through. */
export function fade(hex: string, amount = 0.6) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const BTN = {
  primary: { bg: colors.orange, fg: '#FFFFFF', border: colors.orange },
  dark: { bg: '#0A1C3E', fg: '#FFFFFF', border: '#0A1C3E' },
  light: { bg: '#FFFFFF', fg: colors.ink, border: colors.lineStrong },
  outline: { bg: '#FFFFFF', fg: colors.ink, border: colors.lineStrong },
} as const;

/** Pill button for the customer app. Solid backgrounds, never faded. */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, arrow, style }: ButtonProps) {
  const v = BTN[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        arrow && styles.buttonArrow,
        webCursor,
        pressed && !off && pressFeedback,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : arrow ? (
        <>
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
          <View style={[styles.buttonCircle, { backgroundColor: v.fg }]}>
            <Icon name={icon ?? 'arrowRight'} size={18} color={v.bg} />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

/* ─────────────── Avatar ─────────────── */

const AVATAR_BG_COLORS = ['#FFF1E0', '#E0F2FE', '#E8F5E9', '#FEF3C7', '#F3E8FF', '#FCE7F3'];
const AVATAR_TEXT_COLORS = ['#C2410C', '#0369A1', '#15803D', '#B45309', '#6D28D9', '#BE185D'];
const DICEBEAR_BGS = ['ffa742', '0284c7', '10b981', '8b5cf6', 'f59e0b', 'ec4899'];

export function Avatar({
  name,
  size = 44,
  tone = 'yellow',
  url,
}: {
  name: string;
  size?: number;
  tone?: 'yellow' | 'navy';
  url?: string;
}) {
  const [failed, setFailed] = useState(false);
  const navy = tone === 'navy';
  const nameHash = name ? Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) : 0;
  const colorIdx = nameHash % AVATAR_BG_COLORS.length;

  const avatarUrl = url;
  const fallbackBg = navy ? 'rgba(255,255,255,0.16)' : AVATAR_BG_COLORS[colorIdx];
  const fallbackFg = navy ? '#FFFFFF' : AVATAR_TEXT_COLORS[colorIdx];

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fallbackBg,
          overflow: 'hidden',
        },
      ]}
      accessible
      accessibilityLabel={name}
    >
      {avatarUrl && !failed ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.38), color: fallbackFg }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/* ─────────────── Key/value row ─────────────── */

export function KeyValue({ label, value, strong, valueColor }: { label: string; value: string; strong?: boolean; valueColor?: string }) {
  return (
    <View style={styles.kv}>
      <Text style={[text.body, strong && { color: colors.ink, fontFamily: fonts.semibold }]}>{label}</Text>
      <Text style={[strong ? text.amount : text.bodyStrong, { fontSize: strong ? 17 : 14 }, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/* ─────────────── Menu row (profile, support, drawer-like lists) ─────────────── */

export function MenuRow({
  icon,
  label,
  detail,
  badge,
  onPress,
  danger,
  divider,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  badge?: number | string;
  onPress: () => void;
  danger?: boolean;
  divider?: boolean;
}) {
  return (
    <>
      {divider ? <View style={styles.menuDivider} /> : null}
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, webCursor, pressed && { opacity: 0.7 }]}>
        <View style={[styles.menuIcon, danger && { backgroundColor: colors.dangerTint }]}>
          <Icon name={icon} size={19} color={danger ? colors.danger : colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, danger && { color: colors.danger }]}>{label}</Text>
          {detail ? <Text style={text.caption}>{detail}</Text> : null}
        </View>
        {badge !== undefined && badge !== null && badge !== 0 ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        ) : null}
        {!danger ? (
          <Icon name="chevronRight" size={18} color={colors.inkMuted} strokeWidth={2.2} />
        ) : null}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: shape.card, padding: space.xl },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  iconBtnStone: { borderWidth: 1, borderColor: 'rgba(60, 45, 20, 0.12)' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: app.card,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#FFFFFF' },
  pill: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: shape.chip,
    borderWidth: 1,
    borderColor: app.hairline,
    backgroundColor: app.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: '#0A1C3E', borderColor: '#0A1C3E' },
  pillText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  pillTextOn: { color: '#FFFFFF' },
  pillCount: { fontFamily: fonts.regular, color: colors.inkMuted },
  status: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 13 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.medium, fontSize: 12 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionAction: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },
  button: {
    height: 52,
    borderRadius: shape.chip,
    borderWidth: 1.25,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.1 },
  buttonArrow: { height: 56, borderRadius: 28, justifyContent: 'space-between', paddingLeft: 22, paddingRight: 6 },
  buttonCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, letterSpacing: 0.5 },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  divider: { height: 1, backgroundColor: app.hairline, marginVertical: space.md },
  menuDivider: { height: 1, backgroundColor: '#EFECE6' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: app.cream, borderWidth: 1, borderColor: '#E8E4DA', alignItems: 'center', justifyContent: 'center' },
  menuBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  menuBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlign: 'center',
  },
});
