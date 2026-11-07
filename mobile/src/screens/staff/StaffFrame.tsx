import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../components/app/Icon';
import { useMockView } from '../../laundry/hooks';
import { app, colors, fonts, space } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/** Live (shared with the admin portal), or this device only. */
export function SyncDot() {
  const { sync } = useMockView();
  const live = sync === 'live';
  return (
    <View style={styles.sync} accessible accessibilityLabel={live ? 'Live: synced with the admin portal' : 'This device only'}>
      <View style={[styles.syncDot, { backgroundColor: live ? '#12AD2B' : sync === 'starting' ? colors.inkMuted : app.warning }]} />
      <Text style={styles.syncText}>{live ? 'Live' : sync === 'starting' ? 'Connecting' : 'This device'}</Text>
    </View>
  );
}

/**
 * The staff screens' frame: the same canvas, type and controls as the customer app, without its tabs and menu, so a
 * staff member sees only their location's work. Wide screens (a counter tablet) get a centred column.
 */
export function StaffFrame({
  title,
  subtitle,
  back = true,
  right,
  children,
  footer,
  scroll = true,
  contentStyle,
  dark,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const ink = dark ? '#FFFFFF' : colors.ink;
  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
      <View style={styles.headerInner}>
        {back ? (
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('StaffHome' as never))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={6}
            style={({ pressed }) => [styles.round, dark && styles.roundDark, webCursor, pressed && { opacity: 0.8 }]}
          >
            <Icon name="chevronLeft" size={20} color={ink} />
          </Pressable>
        ) : (
          <View style={styles.badge}>
            <Icon name="shield" size={18} color="#FFFFFF" />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={[styles.title, dark && { color: '#FFFFFF' }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, dark && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
  const body = (
    <View style={[styles.column, contentStyle]}>{children}</View>
  );
  return (
    <View style={[styles.root, dark && { backgroundColor: '#0B0F17' }]}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: (footer ? space.lg : insets.bottom) + space.xxl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content]}>{body}</View>
        )}
        {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}><View style={styles.column}>{footer}</View></View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: app.canvas },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingBottom: space.md },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%', maxWidth: 960, alignSelf: 'center' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: app.cream, alignItems: 'center', justifyContent: 'center' },
  roundDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  badge: { width: 42, height: 42, borderRadius: 21, backgroundColor: app.navyDeep, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs },
  column: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: app.card, borderTopWidth: 1, borderTopColor: app.hairline },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: app.cream },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.inkSoft },
});
