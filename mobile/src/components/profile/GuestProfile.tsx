import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ART, ART_TINT } from '../app/art';
import { CollapsingBar, useCollapsingBar } from '../app/CollapsingBar';
import { Icon } from '../app/Icon';
import { TopBar } from '../app/TopBar';
import { MenuRow } from '../app/primitives';
import { BottomSheet } from '../ui/BottomSheet';
import { AddressesDrawer, type NewAddress } from './ProfileDrawers';
import { addProfileAddress, getSavedAddresses, setDefaultProfileAddress } from '../../services/mock/profile.service';
import { addAddress, setDefaultAddress } from '../../services/mock/account.service';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { RootStackParamList } from '../../navigation/types';
import { brand, colors, fonts, space } from '../../theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const PAGE = space.lg;
const RADIUS = 26;

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(40, 30, 10, 0.06)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 };

/**
 * Clean, lightweight guest profile screen:
 * - App-wide TopBar navbar (logo, title, bell, drawer menu)
 * - Minimal, uncluttered hero card with illustration, punchy headline, and Sign-in CTA
 * - Dedicated MenuRow card (My requests, Saved addresses, Refer & earn, Help & support, Sign in)
 */
export function GuestProfile({ onSignIn, onHelp }: { onSignIn: () => void; onHelp?: () => void }) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const addresses = useQuery(keys.profileAddresses, getSavedAddresses);
  const [addressesOpen, setAddressesOpen] = useState(false);

  const addNewAddress = async (input: NewAddress) => {
    const [saved] = await Promise.all([addProfileAddress(input), addAddress(input)]);
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
    return saved;
  };

  const makeDefault = async (id: string) => {
    await Promise.all([setDefaultProfileAddress(id), setDefaultAddress(id)]);
    invalidate(keys.profileAddresses, keys.addresses, keys.dashboard);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.page,
          {
            paddingTop: (bar.height || Math.max(insets.top, 6) + 54) + space.sm,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero Card */}
        <View style={[styles.hero, soft]}>
          <View style={[styles.art, { backgroundColor: ART_TINT.collecting }]}>
            <Image source={ART.collecting} style={styles.artImg} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View style={styles.artBadge}>
              <View style={styles.artDot} />
              <Text style={styles.artBadgeText}>Guest Mode</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.title}>Your laundry, sorted.</Text>

            <Pressable
              onPress={onSignIn}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              style={({ pressed }) => [styles.cta, webCursor, pressed && { backgroundColor: colors.orangePressed, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.ctaText}>Sign in</Text>
              <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* Account Menu Card */}
        <View style={styles.menuCard}>
          <MenuRow icon="mapPin" label="Saved addresses" onPress={() => setAddressesOpen(true)} />
          <MenuRow divider icon="gift" label="Refer & earn" onPress={() => navigation.navigate('Refer')} />
          <MenuRow divider icon="headset" label="Help & support" onPress={() => (onHelp ? onHelp() : navigation.navigate('Support'))} />
          <MenuRow divider icon="user" label="Sign in" onPress={onSignIn} />
        </View>
      </Animated.ScrollView>

      {/* Standard App Top Navbar */}
      <CollapsingBar bar={bar} style={{ paddingTop: Math.max(insets.top, 6) }}>
        <View style={styles.barInner}>
          <TopBar padded={false} title="Profile" />
        </View>
      </CollapsingBar>

      {/* Saved Addresses Drawer */}
      <BottomSheet visible={addressesOpen} onClose={() => setAddressesOpen(false)}>
        {addresses.data ? (
          <AddressesDrawer
            addresses={addresses.data}
            onMakeDefault={makeDefault}
            onAdd={addNewAddress}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9F6' },
  page: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  barInner: {
    paddingHorizontal: PAGE,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },

  hero: {
    borderRadius: RADIUS,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEEAE2',
  },
  art: { height: 175, overflow: 'hidden', justifyContent: 'flex-end' },
  artImg: { position: 'absolute', left: 0, right: 0, top: -45, height: 290, width: '100%' },
  artBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    margin: 12,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  artDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  artBadgeText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink },

  heroBody: {
    padding: space.lg,
    paddingTop: 18,
    paddingBottom: 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: colors.ink,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.orange,
    marginTop: 16,
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },

  menuCard: {
    borderRadius: RADIUS,
    backgroundColor: '#FFFFFF',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: '#E8E4DA',
    ...soft,
  },
});
