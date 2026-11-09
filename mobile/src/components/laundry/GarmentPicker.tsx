import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../../lib/haptics';
import { money } from '../../lib/format';
import { billedQty, garmentCount, garmentGroupsFor, type GarmentPick } from '../../mock/engine/garments';
import { MAX_QTY_PER_ITEM } from '../../mock/engine/ops';
import type { CatalogItem } from '../../mock/types';
import { colors, fonts, space } from '../../theme';
import { Icon, type IconName } from '../app/Icon';
import { GarmentIcon } from './GarmentIcon';
import { QtyStepper } from './QtyStepper';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const INK = colors.ink;

export type PickerService = {
  item: CatalogItem;
  categoryId: string;
  categoryName: string;
  color: string;
  icon: IconName;
};

export type GarmentCounts = Record<string, number>;

export const picksOf = (counts: GarmentCounts | undefined): GarmentPick[] =>
  Object.entries(counts ?? {})
    .filter(([, q]) => q > 0)
    .map(([garmentId, qty]) => ({ garmentId, qty }));

/**
 * Modern app drawer for choosing clothes:
 * Leaves a clear gap above over a dimmed backdrop, styled consistently with the "Pick a service" cards,
 * clean and non-text-heavy with compact steppers and sticky total bar.
 */
export function GarmentPicker({
  visible,
  service,
  counts,
  onChange,
  onClose,
}: {
  visible: boolean;
  service: PickerService | null;
  counts: GarmentCounts;
  onChange: (next: GarmentCounts) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const travelDist = windowHeight > 0 ? windowHeight : 850;

  const groups = useMemo(() => (service ? garmentGroupsFor(service.categoryId) : []), [service]);
  const [active, setActive] = useState<string | null>(null);
  const [undo, setUndo] = useState<GarmentCounts | null>(null);
  const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Bottom drawer spring slide animation from completely off-screen
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.value = withSpring(1, {
        damping: 28,
        stiffness: 280,
        mass: 0.85,
        overshootClamping: false,
      });
    } else if (mounted) {
      t.value = withTiming(0, { duration: 240, easing: Easing.bezier(0.33, 0, 0.67, 0) });
      const id = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(id);
    }
  }, [visible, mounted, t]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0, 0.54], 'clamp'),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(t.value, [0, 1], [travelDist, 0]),
      },
      {
        scale: interpolate(t.value, [0, 1], [0.97, 1]),
      },
    ],
  }));

  // Start on the first tab with existing picks, or the first tab
  const openFor = visible ? (service?.item.id ?? null) : null;
  const [seenOpen, setSeenOpen] = useState<string | null>(null);
  if (openFor !== seenOpen) {
    setSeenOpen(openFor);
    if (openFor && groups.length) {
      const withPicks = groups.find((g) => g.garments.some((x) => (counts[x.id] ?? 0) > 0));
      setActive((withPicks ?? groups[0]).group.id);
      setUndo(null);
    }
  }

  // Clear undo timer
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 4000);
    return () => clearTimeout(id);
  }, [undo]);

  if (!mounted && !visible) return null;
  if (!service) return null;

  const { item } = service;
  const picks = picksOf(counts);
  const pieces = garmentCount(picks);
  const isKg = item.unit === 'kg';
  const qty = billedQty(item.unit, picks);
  const total = qty * item.price;
  const current = groups.find((g) => g.group.id === active) ?? groups[0];
  const unitWord = item.unit === 'pair' ? 'pair' : item.unit === 'kg' ? 'kg' : 'piece';
  const unitBadge = item.unit === 'kg' ? 'PER KG' : item.unit === 'pair' ? 'PER PAIR' : 'PER PIECE';
  const [service0, variant] = item.name.includes(' · ') ? item.name.split(' · ') : [item.name, null];

  const set = (id: string, n: number) => onChange({ ...counts, [id]: n });
  const clearAll = () => {
    haptic.tap();
    setUndo(counts);
    onChange({});
  };
  const restore = () => {
    if (!undo) return;
    haptic.tap();
    onChange(undo);
    setUndo(null);
  };
  const pickTab = (id: string) => {
    if (id === active) return;
    haptic.tap();
    setActive(id);
    listRef.current?.scrollTo({ y: 0, animated: false });
  };
  const done = () => {
    if (pieces > 0) haptic.success();
    onClose();
  };

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={done} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Dimmed backdrop overlay covering the gap above */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={done} accessibilityRole="button" accessibilityLabel="Close drawer" />
        </Animated.View>

        {/* Sliding App Drawer Sheet - leaves top gap */}
        <Animated.View style={[styles.drawer, sheetStyle]} accessibilityViewIsModal>
          {/* Top drag handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Drawer header matching the "Pick a service" card header */}
          <View style={styles.header}>
            <View style={styles.topRow}>
              {/* Category Ribbon */}
              <View style={[styles.ribbon, { backgroundColor: service.color }]}>
                <Icon name={service.icon} size={13} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.ribbonText} numberOfLines={1}>
                  {service.categoryName}
                </Text>
              </View>

              <View style={styles.topRight}>
                {/* Unit badge matching pick service */}
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>{unitBadge}</Text>
                </View>

                {/* Close chevron button */}
                <Pressable
                  onPress={done}
                  accessibilityRole="button"
                  accessibilityLabel="Close drawer"
                  hitSlop={8}
                  style={({ pressed }) => [styles.closeBtn, webCursor, pressed && { opacity: 0.7 }]}
                >
                  <Icon name="chevronDown" size={16} color={INK} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>

            {/* Service title & price line */}
            <View style={styles.titleRow}>
              <View style={styles.titleCol}>
                <Text style={styles.title} numberOfLines={1}>
                  {service0}
                  {variant ? <Text style={styles.titleVariant}> · {variant}</Text> : null}
                </Text>
                <Text style={styles.priceLine}>
                  {money(item.price)}
                  <Text style={styles.priceUnit}> / {unitWord}</Text>
                </Text>
              </View>

              {pieces > 0 ? (
                <Pressable
                  onPress={clearAll}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all clothes"
                  hitSlop={8}
                  style={({ pressed }) => [styles.clearBtn, webCursor, pressed && { opacity: 0.7 }]}
                >
                  <Icon name="trash" size={12} color={colors.danger} strokeWidth={2.2} />
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Dashed line matching the pick service card */}
            <View style={styles.dashedLine} />
          </View>

          {/* Category Chips - clean & horizontal */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
            {groups.map(({ group, garments }) => {
              const on = group.id === current?.group.id;
              const n = garments.reduce((s, g) => s + (counts[g.id] ?? 0), 0);
              return (
                <Pressable
                  key={group.id}
                  onPress={() => pickTab(group.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${group.name}${n ? `, ${n} added` : ''}`}
                  style={({ pressed }) => [
                    styles.chip,
                    on && styles.chipOn,
                    webCursor,
                    pressed && !on && { backgroundColor: '#ECEAE3' },
                  ]}
                >
                  <GarmentIcon name={group.icon} size={20} />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{group.name}</Text>
                  {n > 0 ? (
                    <Animated.View entering={FadeIn.duration(160)} style={[styles.badge, on && styles.badgeOn]}>
                      <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{n}</Text>
                    </Animated.View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Clean, non-text-heavy Garment List */}
          <ScrollView
            ref={listRef}
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {current ? (
              <View style={styles.card}>
                {current.garments.map((g, i) => {
                  const n = counts[g.id] ?? 0;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={
                        n === 0
                          ? () => {
                              haptic.tap();
                              set(g.id, 1);
                            }
                          : undefined
                      }
                      accessible={false}
                      style={[styles.row, i > 0 && styles.rowDivider, n === 0 && webCursor]}
                    >
                      <GarmentIcon name={g.icon} size={34} />
                      <View style={styles.flex}>
                        <Text style={styles.name} numberOfLines={1}>
                          {g.name}
                        </Text>
                      </View>
                      <QtyStepper value={n} max={MAX_QTY_PER_ITEM} label={g.name} onChange={(v) => set(g.id, v)} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.empty}>
                <Icon name="inbox" size={24} color={colors.inkMuted} />
                <Text style={styles.emptyText}>No items in this category</Text>
              </View>
            )}
          </ScrollView>

          {/* Sticky Running Total Footer */}
          <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {undo ? (
              <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(140)} style={styles.undo}>
                <Text style={styles.undoText}>List cleared</Text>
                <Pressable onPress={restore} accessibilityRole="button" accessibilityLabel="Undo clear" hitSlop={10} style={webCursor}>
                  <Text style={styles.undoAction}>Undo</Text>
                </Pressable>
              </Animated.View>
            ) : null}
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                {pieces === 0 ? (
                  <Text style={styles.barEmpty}>0 clothes added</Text>
                ) : (
                  <>
                    <Animated.Text key={total} entering={FadeInDown.duration(140)} style={styles.barTotal}>
                      {isKg ? '≈ ' : ''}
                      {money(total)}
                    </Animated.Text>
                    <Text style={styles.barSub}>
                      {pieces} {pieces === 1 ? 'piece' : 'pieces'}
                    </Text>
                  </>
                )}
              </View>
              <Pressable
                onPress={done}
                accessibilityRole="button"
                accessibilityLabel={pieces ? `Done, ${pieces} clothes added` : 'Close'}
                style={({ pressed }) => [
                  styles.cta,
                  pieces === 0 && styles.ctaGhost,
                  webCursor,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={[styles.ctaText, pieces === 0 && styles.ctaGhostText]}>{pieces ? 'Done' : 'Close'}</Text>
                {pieces ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.6} /> : null}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    backgroundColor: '#0A1C3E',
  },
  drawer: {
    width: '100%',
    maxWidth: 520,
    height: Platform.OS === 'web' ? '75vh' : '75%',
    maxHeight: Platform.OS === 'web' ? '76vh' : '76%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -14px 44px rgba(10, 28, 62, 0.22)' } as object)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.2,
          shadowRadius: 24,
          elevation: 24,
        }),
  },
  handleWrap: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    width: '100%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D3CD',
  },

  flex: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 14,
  },
  ribbonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: colors.inkSoft,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F4F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: INK,
  },
  titleVariant: {
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
  },
  priceLine: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: INK,
    marginTop: 2,
  },
  priceUnit: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: '#FFF0F2',
    borderWidth: 1,
    borderColor: '#FED8DC',
  },
  clearText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.danger,
  },

  dashedLine: {
    borderTopWidth: 1,
    borderColor: '#CDD2DA',
    borderStyle: 'dashed',
    marginTop: 10,
    marginBottom: 4,
  },

  chipsScroll: {
    flexGrow: 0,
    marginTop: 4,
    marginBottom: 6,
  },
  chips: {
    paddingHorizontal: space.lg,
    gap: 7,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E2D9',
  },
  chipOn: {
    backgroundColor: '#FFFFFF',
    borderColor: INK,
    borderWidth: 1.4,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  chipTextOn: {
    fontFamily: fonts.bold,
    color: INK,
  },
  badge: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 8.5,
    backgroundColor: '#ECEAE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOn: {
    backgroundColor: INK,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  badgeTextOn: {
    color: '#FFFFFF',
  },

  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: space.lg,
    paddingTop: 4,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFECE6',
    paddingHorizontal: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: 8,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3ED',
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: INK,
  },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
  },

  footerWrap: {
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
    paddingHorizontal: space.lg,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
  },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    gap: space.lg,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: INK,
    marginBottom: 8,
  },
  undoText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  undoAction: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 44,
  },
  barTotal: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  barEmpty: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.inkMuted,
  },
  barSub: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    minWidth: 96,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: INK,
  },
  ctaGhost: {
    backgroundColor: '#F4F2EC',
    borderWidth: 0,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  ctaGhostText: {
    color: INK,
  },
});
