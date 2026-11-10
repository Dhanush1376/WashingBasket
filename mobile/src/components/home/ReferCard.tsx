import React, { useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { brand, colors, fonts, shape, space } from '../../theme';
import { Icon } from '../app/Icon';
import { haptic } from '../../lib/haptics';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const INK = '#0A1C3E';

const liftShadow =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 4px 20px rgba(10, 28, 62, 0.06), 0 1px 3px rgba(10, 28, 62, 0.03)' } as object)
    : { shadowColor: INK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 };

/**
 * Refer & Earn Card on Home screen:
 * Clean, modern, warm card without box-in-box clutter.
 * Direct value proposition headline, tactile copy-to-clipboard, share button, and clean airy stats.
 */
const MINI_FRIEND_AVATARS = [
  {
    name: 'Ananya',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Sophia&skinColor=ffdbb4&hairColor=4a312c&top=bob&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=013e86&backgroundColor=dcfce7',
    bg: '#DCFCE7',
    fg: '#15803D',
    initials: 'AR',
  },
  {
    name: 'Rahul',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Alexander&skinColor=ffdbb4&hairColor=2c1b18&top=shortFlat&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=262e33&backgroundColor=e0f2fe',
    bg: '#E0F2FE',
    fg: '#0369A1',
    initials: 'RM',
  },
  {
    name: 'Sneha',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Emma&skinColor=ffdbb4&hairColor=2c1b18&top=straight01&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=shirtScoopNeck&clothingColor=013e86&backgroundColor=ffe4e6',
    bg: '#FFE4E6',
    fg: '#C2410C',
    initials: 'SK',
  },
];

export function ReferCard({
  reward,
  friendReward,
  code,
  invited,
  joined,
  earned,
  onOpen,
}: {
  reward: number;
  friendReward: number;
  /** The customer's own code; left out for guests. */
  code?: string;
  invited: number;
  joined: number;
  earned: number;
  onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!code) {
      onOpen();
      return;
    }
    const message = `Get ₹${friendReward} off on your laundry with Washing Basket! Use my code ${code} when you sign up.`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(code);
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Refer and earn. Give ₹${friendReward}, get ₹${reward}`}
      style={({ pressed }) => [styles.card, liftShadow, webCursor, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      {/* ── Top Header Row: Gift badge + Value Proposition side-by-side on left, Arrow button on right ── */}
      <View style={styles.headTop}>
        <View style={styles.headLeft}>
          <View style={styles.tileIcon}>
            <Icon name="gift" size={19} color={brand.navy} strokeWidth={2.2} />
          </View>
          <View style={styles.heroWrap}>
            <Text style={styles.kicker}>REFER & EARN</Text>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              Give ₹{friendReward}, get ₹{reward}
            </Text>
          </View>
        </View>
        <View style={styles.goBtn}>
          <Icon name="arrowUpRight" size={15} color={colors.ink} strokeWidth={2.2} />
        </View>
      </View>

      {/* ── Code & Action Bar ── */}
      {code ? (
        <View style={styles.codeRow}>
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={`Copy referral code ${code}`}
            style={({ pressed }) => [styles.codeInfo, webCursor, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.codeMeta}>
              <Text style={styles.codeKicker}>YOUR CODE</Text>
              {copied ? (
                <View style={styles.copiedBadge}>
                  <Icon name="check" size={10} color="#059669" strokeWidth={2.6} />
                  <Text style={styles.copiedText}>Copied!</Text>
                </View>
              ) : (
                <View style={styles.tapCopyRow}>
                  <Icon name="copy" size={10} color="#64748B" strokeWidth={2} />
                  <Text style={styles.tapCopyText}>Tap to copy</Text>
                </View>
              )}
            </View>
            <Text style={styles.code}>{code}</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share referral code"
            style={({ pressed }) => [
              styles.shareBtn,
              webCursor,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Icon name="share" size={13.5} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guestBox}>
          <Text style={styles.guestText}>Sign in to unlock your referral code</Text>
          <Icon name="chevronRight" size={16} color={colors.inkMuted} strokeWidth={2.2} />
        </View>
      )}

      {/* ── Airy Stats Row: Friends avatar preview & clean metrics ── */}
      {code ? (
        <View style={styles.statsStrip}>
          <View style={styles.avatarStackMini}>
            {MINI_FRIEND_AVATARS.map((m, idx) => (
              <View
                key={m.name}
                style={[
                  styles.avatarCircleMini,
                  { zIndex: idx + 1, marginLeft: idx > 0 ? -9 : 0, backgroundColor: m.bg },
                ]}
              >
                <Image
                  source={{ uri: m.url }}
                  style={styles.avatarImgMini}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>

          <View style={styles.statsColsWrap}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{invited}</Text>
              <Text style={styles.statLbl}>Invited</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{joined}</Text>
              <Text style={styles.statLbl}>Joined</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, styles.earnedVal]}>₹{earned}</Text>
              <Text style={[styles.statLbl, styles.earnedLbl]}>Earned</Text>
            </View>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4CFBF',
    padding: 18,
    marginBottom: space.lg,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 20px rgba(10, 28, 62, 0.08), 0 1px 3px rgba(10, 28, 62, 0.04)',
        } as object)
      : {
          shadowColor: INK,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 3,
        }),
  },
  headTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  goBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F2EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 3px rgba(10, 28, 62, 0.06)' } as object)
      : { shadowColor: INK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 }),
  },
  heroWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: brand.navy,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.5,
    color: INK,
  },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: '#FAF8F4',
    borderWidth: 1.25,
    borderColor: '#EAE4D8',
  },
  codeInfo: {
    flex: 1,
  },
  codeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeKicker: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.9,
    color: '#94A3B8',
  },
  tapCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tapCopyText: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: '#64748B',
  },
  copiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  copiedText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#059669',
  },
  code: {
    fontFamily: fonts.bold,
    fontSize: 17.5,
    letterSpacing: 1.5,
    color: INK,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: INK,
  },
  shareText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  guestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FAF8F4',
    borderWidth: 1,
    borderColor: '#EAE4D8',
  },
  guestText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: INK,
  },

  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
    gap: 12,
  },
  avatarStackMini: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircleMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImgMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarTextMini: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  statsColsWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  statLbl: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#EBE6DC',
  },
  earnedVal: {
    color: '#059669',
  },
  earnedLbl: {
    color: '#059669',
    fontFamily: fonts.semibold,
  },
});
