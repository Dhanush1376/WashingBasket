import React, { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { app, colors, shape, space, text } from '../../theme';
import { Icon, IconName } from './Icon';
import { Button } from './primitives';

/** Placeholder block with a slow, soft pulse (no spinner for content that has a known shape). */
export function Skeleton({ height, width = '100%', radius = shape.inner, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: app.creamDeep }, anim, style]} />;
}

/** A column of skeleton cards sized like list rows. */
export function ListSkeleton({ rows = 3, height = 96 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={shape.tile} />
      ))}
    </View>
  );
}

type EmptyProps = {
  title: string;
  message: string;
  icon?: IconName;
  art?: ImageSourcePropType;
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'dark' | 'light' | 'outline' };
  secondaryAction?: { label: string; onPress: () => void };
};

/** Friendly empty state: an illustration or icon, one line of why, one way forward. */
export function EmptyState({ title, message, icon = 'inbox', art, action, secondaryAction }: EmptyProps) {
  return (
    <View style={styles.empty}>
      {art ? (
        <Image source={art} style={styles.emptyArt} resizeMode="contain" />
      ) : (
        <View style={styles.emptyIconRing}>
          <View style={styles.emptyIcon}>
            <Icon name={icon} size={24} color={colors.navy} strokeWidth={2.2} />
          </View>
        </View>
      )}
      <Text style={[text.h2, styles.center]}>{title}</Text>
      <Text style={[text.body, styles.center, styles.emptyMsg]}>{message}</Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'dark'}
          style={styles.emptyCta}
        />
      ) : null}
      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="light"
          style={styles.emptySecondaryCta}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({ message = "We couldn't load this right now.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerTint }]}>
        <Icon name="alert" size={26} color={colors.danger} />
      </View>
      <Text style={[text.h2, styles.center]}>Something went wrong</Text>
      <Text style={[text.body, styles.center, styles.emptyMsg]}>{message}</Text>
      <Button label="Try again" icon="refresh" variant="outline" onPress={onRetry} style={styles.emptyCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
  emptyArt: { width: 200, height: 150, marginBottom: space.lg },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3EFE6',
    borderWidth: 1.5,
    borderColor: '#E8E3D7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  emptyMsg: { marginTop: 6, maxWidth: 320, lineHeight: 20 },
  emptyCta: { marginTop: space.xl, maxWidth: 280, width: '100%', alignSelf: 'center' },
  emptySecondaryCta: { marginTop: space.sm, maxWidth: 280, width: '100%', alignSelf: 'center' },
});
