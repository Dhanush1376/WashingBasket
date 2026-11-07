import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { Icon, type IconName } from '../../components/app/Icon';
import { Rise } from '../../components/app/motion';
import { Avatar, Button } from '../../components/app/primitives';
import { ErrorState, Skeleton } from '../../components/app/states';
import { TopBar } from '../../components/app/TopBar';
import { FloatingBottomBar } from '../../components/navigation/FloatingBottomBar';
import { ReferralCodeDrawer } from '../../components/refer/ReferralCodeDrawer';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { dateParts, money } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { getReferrals, type ReferralSummary } from '../../services/mock/account.service';
import { colors, fonts, space } from '../../theme';
import type { Referral, ReferralStatus } from '../../types/models';

const CANVAS = '#FAF9F6';
const BEIGE = '#F4F1EA';
const BEIGE_RGB = '244, 241, 234';
const NAVY = '#0A1C3E';
const YELLOW = '#FEC837';
const STUB_GOLD = '#EFB21C';
const PAGE = space.lg;
const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const EASE_OUT = Easing.out(Easing.cubic);

const shortDate = (iso: string) => {
  const p = dateParts(iso);
  return `${p.day} ${p.month}`;
};

interface HowItWorksStep {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
}

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: 'step-1',
    icon: 'share',
    title: 'Share your ticket pass',
    detail:
      'Share your invitation pass code with friends, roommates & batchmates across campus. They save ₹100 instantly on their first wash.',
  },
  {
    id: 'step-2',
    icon: 'truck',
    title: 'Friend books a laundry pickup',
    detail:
      'Your friend applies your pass code when scheduling their first laundry wash & fold, steam iron, or dry cleaning order.',
  },
  {
    id: 'step-3',
    icon: 'wallet',
    title: 'You get ₹200 instant cash',
    detail:
      'As soon as their clothes are washed and safely delivered, ₹200 is credited straight to your Washing Basket wallet balance.',
  },
];

const REFERRAL_FAQS = [
  {
    id: 'faq-1',
    question: 'How many friends can I invite?',
    answer:
      'There is no limit! You can invite as many friends, batchmates, and colleagues as you like and earn ₹200 for every successful first order.',
  },
  {
    id: 'faq-2',
    question: 'When will my reward be credited?',
    answer:
      'Your ₹200 bonus will automatically be credited to your wallet within 1 hour after your friend’s first order is marked as Delivered.',
  },
  {
    id: 'faq-3',
    question: 'Can my reward be used for all laundry services?',
    answer:
      'Yes! Your referral wallet balance can be applied towards any laundry service, including wash & fold, steam iron, premium dry cleaning, and shoe care.',
  },
];

const ticketShadow =
  Platform.OS === 'web'
    ? ({
        boxShadow:
          '0 14px 32px -4px rgba(10, 28, 62, 0.16), 0 3px 10px -2px rgba(10, 28, 62, 0.08)',
      } as object)
    : {
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
      };

/** Authentic VIP Invitation Ticket geometry with horizontal tear perforation */
function horizontalTicketPath(w: number, h: number, r: number, nr: number, sy: number) {
  return (
    `M${r} 0` +
    `H${w - r}` +
    `A${r} ${r} 0 0 1 ${w} ${r}` +
    `V${sy - nr}` +
    `A${nr} ${nr} 0 0 0 ${w} ${sy + nr}` +
    `V${h - r}` +
    `A${r} ${r} 0 0 1 ${w - r} ${h}` +
    `H${r}` +
    `A${r} ${r} 0 0 1 0 ${h - r}` +
    `V${sy + nr}` +
    `A${nr} ${nr} 0 0 0 0 ${sy - nr}` +
    `V${r}` +
    `A${r} ${r} 0 0 1 ${r} 0Z`
  );
}

/** Exclusive VIP Campus Invitation Boarding Pass (Not a generic coupon code) */
function ReferralTicket({
  w,
  data,
  code,
  copied,
  onCopy,
}: {
  w: number;
  data: ReferralSummary;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const u = Math.min(1.15, Math.max(0.88, w / 340));
  const ticketH = Math.round(218 * u);
  const notchR = Math.round(10 * u);
  const cornerR = Math.round(24 * u);
  const splitY = Math.round(ticketH * 0.63);

  const d = horizontalTicketPath(w, ticketH, cornerR, notchR, splitY);

  return (
    <View style={[styles.ticketContainer, ticketShadow]}>
      <View style={{ width: w, height: ticketH }}>
        {/* Pass Base: Deep Midnight Navy with subtle border */}
        <Svg width={w} height={ticketH} style={StyleSheet.absoluteFill}>
          <Path d={d} fill={NAVY} />
          <Path d={d} fill="none" stroke="rgba(255, 255, 255, 0.16)" strokeWidth={1.5} />
          {/* Horizontal tear-off perforation line */}
          <Line
            x1={notchR + 4 * u}
            y1={splitY}
            x2={w - notchR - 4 * u}
            y2={splitY}
            stroke="#FFFFFF"
            strokeWidth={1.2}
            strokeDasharray={`${5 * u} ${4 * u}`}
            strokeOpacity={0.22}
          />
        </Svg>

        {/* ── Top Body: Pass Header, Big Value & Key Perks ── */}
        <View
          style={[
            styles.ticketTopBody,
            {
              height: splitY,
              paddingHorizontal: 18 * u,
              paddingTop: 16 * u,
              paddingBottom: 10 * u,
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.ticketHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * u }}>
              <Icon name="sparkle" size={12 * u} color="#FFA742" strokeWidth={2.4} />
              <Text style={[styles.ticketKicker, { fontSize: 10 * u, letterSpacing: 1.2 * u }]}>
                CAMPUS INVITATION PASS
              </Text>
            </View>

            <View style={[styles.ticketVipBadge, { paddingHorizontal: 8 * u, height: 20 * u, borderRadius: 10 * u }]}>
              <Text style={[styles.ticketVipBadgeText, { fontSize: 9 * u }]}>VIP PASS</Text>
            </View>
          </View>

          {/* Value Prop Headline */}
          <View style={{ marginTop: 6 * u }}>
            <Text style={[styles.ticketHeadline, { fontSize: 20 * u }]}>
              Give ₹{data.rules.welcomeReward} • Get <Text style={{ color: '#FFA742' }}>₹{data.rewardPerReferral}</Text>
            </Text>
            <Text style={[styles.ticketSubtext, { fontSize: 11.5 * u, marginTop: 2 * u }]}>
              Friend saves ₹{data.rules.welcomeReward} on 1st wash • You get ₹{data.rewardPerReferral} wallet cash
            </Text>
          </View>

          {/* Micro Perks Tagline */}
          <View style={[styles.ticketPerksStrip, { marginTop: 8 * u }]}>
            <Text style={[styles.ticketPerksText, { fontSize: 10 * u }]}>
              ⚡ Instant Cash  •  👥 Unlimited Friends  •  🧺 All Services
            </Text>
          </View>
        </View>

        {/* ── Bottom Stub: Code Pill & Claim Action ── */}
        <View
          style={[
            styles.ticketBottomStub,
            {
              top: splitY,
              height: ticketH - splitY,
              paddingHorizontal: 18 * u,
            },
          ]}
        >
          {/* Monospaced Code Pill */}
          <View style={[styles.ticketCodePill, { height: 40 * u, borderRadius: 20 * u }]}>
            <Text style={[styles.ticketCodeText, { fontSize: 16 * u }]}>{code}</Text>
            <Pressable
              onPress={onCopy}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Code copied' : 'Copy referral code'}
              style={({ pressed }) => [
                styles.ticketCopyBtn,
                copied && styles.ticketCopyBtnCopied,
                webCursor,
                pressed && { transform: [{ scale: 0.94 }] },
                { height: 32 * u, paddingHorizontal: 12 * u, borderRadius: 16 * u },
              ]}
            >
              <Icon
                name={copied ? 'check' : 'copy'}
                size={12 * u}
                color="#FFFFFF"
                strokeWidth={2.4}
              />
              <Text style={[styles.ticketCopyBtnText, { fontSize: 10.5 * u }]}>
                {copied ? 'COPIED' : 'COPY'}
              </Text>
            </Pressable>
          </View>

          {/* Right Pass Metadata */}
          <View style={styles.ticketStubMeta}>
            <Text style={[styles.ticketStubMetaTop, { fontSize: 8.5 * u }]}>
              ADMIT: ALL FRIENDS
            </Text>
            <Text style={[styles.ticketStubMetaBtm, { fontSize: 8.5 * u }]}>
              NO EXPIRY • 100% CASH
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Refer & earn screen:
 * Displays your invitation ticket, referral statistics, interactive FAQ, and newly redesigned friend history hub.
 */
const FRIEND_AVATARS: Record<
  string,
  { url: string; bg: string; fg: string; badge: string; badgeIcon: IconName }
> = {
  'Sneha K.': {
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Emma&skinColor=ffdbb4&hairColor=2c1b18&top=straight01&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=shirtScoopNeck&clothingColor=013e86&backgroundColor=ffe4e6',
    bg: '#FFE4E6',
    fg: '#C2410C',
    badge: '#0A1C3E',
    badgeIcon: 'share',
  },
  'Rahul M.': {
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Alexander&skinColor=ffdbb4&hairColor=2c1b18&top=shortFlat&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=262e33&backgroundColor=e0f2fe',
    bg: '#E0F2FE',
    fg: '#0369A1',
    badge: '#FFA742',
    badgeIcon: 'truck',
  },
  'Ananya R.': {
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Sophia&skinColor=ffdbb4&hairColor=4a312c&top=bob&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=013e86&backgroundColor=dcfce7',
    bg: '#DCFCE7',
    fg: '#15803D',
    badge: '#10B981',
    badgeIcon: 'check',
  },
};

function FriendAvatarItem({ name, status }: { name: string; status: string }) {
  const [failed, setFailed] = useState(false);
  const cfg = FRIEND_AVATARS[name] ?? {
    url: `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(name)}&backgroundColor=ffe4e6`,
    bg: '#FFF1E0',
    fg: '#C2410C',
    badge: status === 'rewarded' ? '#10B981' : status === 'joined' ? '#FFA742' : '#0A1C3E',
    badgeIcon: (status === 'rewarded' ? 'check' : status === 'joined' ? 'truck' : 'share') as IconName,
  };
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.friendAvatarWrap}>
      <View style={[styles.friendAvatarCircle, { backgroundColor: cfg.bg }]}>
        {!failed ? (
          <Image
            source={{ uri: cfg.url }}
            style={styles.friendAvatarImg}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={[styles.friendAvatarInitials, { color: cfg.fg }]}>{initials}</Text>
        )}
      </View>
      <View style={[styles.friendAvatarBadge, { backgroundColor: cfg.badge }]}>
        <Icon name={cfg.badgeIcon} size={8.5} color="#FFFFFF" strokeWidth={2.8} />
      </View>
    </View>
  );
}

export function ReferScreen({ navigation }: ScreenProps<'Refer'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const ref = useQuery(keys.referrals, getReferrals);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const { width: screenW } = useWindowDimensions();

  // Accordion state
  const [openStep, setOpenStep] = useState<string | null>('step-1');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(id);
  }, [copied]);

  const data = ref.data;
  const code = data?.code ?? '';
  const message = `Get ₹${data?.rules.welcomeReward ?? 100} off your laundry with Washing Basket! Use my invitation pass code: ${code}`;

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    haptic.success();
    setCopied(true);
  };

  const share = async () => {
    if (!code) return;
    setShareNote(null);
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      setShareNote('Sharing isn’t available here, so the invite message was copied.');
    }
  };

  const bottomGap = Math.max(insets.bottom, 12) + 68;
  const joined = data ? data.history.filter((r) => r.status !== 'invited').length : 0;
  const rewardedCount = data ? data.history.filter((r) => r.status === 'rewarded').length : 0;
  const pendingCount = data ? data.history.filter((r) => r.status === 'joined').length : 0;
  const invitedCount = data ? data.history.filter((r) => r.status === 'invited').length : 0;
  const ticketW = Math.min(Math.round(screenW - PAGE * 2), 440);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: bar.height + space.xs,
          paddingBottom: bottomGap + 100,
        }}
      >
        {ref.loading ? (
          <View style={[styles.page, { gap: space.md, paddingTop: space.md }]}>
            <Skeleton height={180} radius={26} />
            <Skeleton height={200} radius={22} />
            <Skeleton height={160} radius={22} />
          </View>
        ) : ref.error || !data ? (
          <View style={[styles.page, { paddingTop: space.lg }]}>
            <ErrorState message="Could not load your referral details." onRetry={ref.refetch} />
          </View>
        ) : (
          <>
            {/* ── 1. Top Warm Beige Header Panel ── */}
            <View style={styles.panel}>
              <View style={styles.panelInner}>
                <Rise delay={60} distance={12}>
                  <Text style={styles.hello}>
                    Give ₹{data.rules.welcomeReward}, get{' '}
                    <Text style={styles.helloOrange}>₹{data.rewardPerReferral}</Text>
                  </Text>
                  <Text style={styles.helloSub}>
                    Invite campus friends to Washing Basket & earn instant cash
                  </Text>
                  <View style={styles.tags}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>NO LIMIT</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>INSTANT WALLET CASH</Text>
                    </View>
                  </View>
                </Rise>
              </View>
            </View>

            {/* ── 2. Content Body overlapping top panel ── */}
            <View style={styles.page}>
              <View style={styles.cards}>
                {/* ── The VIP Invitation Ticket ── */}
                <Deal delay={120}>
                  <ReferralTicket
                    w={ticketW}
                    data={data}
                    code={code}
                    copied={copied}
                    onCopy={copy}
                  />
                </Deal>

                {/* ── Total Earned / Stats Strip Card ── */}
                <Deal delay={200}>
                  <View style={styles.statsCard}>
                    <View style={styles.statCol}>
                      <Text style={styles.statNum}>{money(data.earned)}</Text>
                      <Text style={styles.statLabel}>Total Earned</Text>
                    </View>
                    <View style={styles.statRule} />
                    <View style={styles.statCol}>
                      <Text style={styles.statNum}>{joined}</Text>
                      <Text style={styles.statLabel}>Friends Joined</Text>
                    </View>
                    <View style={styles.statRule} />
                    <View style={styles.statCol}>
                      <Text style={[styles.statNum, styles.statPending]}>
                        {money(data.pending)}
                      </Text>
                      <Text style={styles.statLabel}>Pending Cash</Text>
                    </View>
                  </View>
                </Deal>

                {/* ── 3. How It Works Accordion ── */}
                <Rise delay={280} distance={10}>
                  <SectionHead title="HOW IT WORKS" />
                  <View style={styles.stepsCard}>
                    {HOW_IT_WORKS_STEPS.map((s, i) => (
                      <AccordionItem
                        key={s.id}
                        icon={s.icon}
                        title={s.title}
                        content={s.detail}
                        isFirst={i === 0}
                        open={openStep === s.id}
                        onToggle={() => setOpenStep(openStep === s.id ? null : s.id)}
                      />
                    ))}
                  </View>
                </Rise>

                {/* ── 4. Frequently Asked Questions ── */}
                <Rise delay={360} distance={10}>
                  <SectionHead title="FREQUENTLY ASKED" />
                  <View style={styles.stepsCard}>
                    {REFERRAL_FAQS.map((f, i) => (
                      <AccordionItem
                        key={f.id}
                        title={f.question}
                        content={f.answer}
                        isFirst={i === 0}
                        open={openFaq === f.id}
                        onToggle={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                      />
                    ))}
                  </View>
                </Rise>

                {/* ── 5. Clean Refined Friends Section (Placed BELOW FAQ) ── */}
                <Rise delay={440} distance={10}>
                  <View style={styles.friendsSectionHeader}>
                    <View style={styles.friendsHeaderTitleGroup}>
                      <Text style={styles.friendsSectionTitle}>Friends invited</Text>
                      <View style={styles.friendsCountPill}>
                        <Text style={styles.friendsCountText}>{data.history.length}</Text>
                      </View>
                    </View>

                    {data.applied ? null : (
                      <Pressable
                        onPress={() => setCodeOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Have a referral code?"
                        style={({ pressed }) => [
                          styles.haveCodeBtn,
                          webCursor,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
                        ]}
                      >
                        <Icon name="tag" size={12} color={NAVY} strokeWidth={2.2} />
                        <Text style={styles.haveCodeText}>Have a code?</Text>
                      </Pressable>
                    )}
                  </View>

                  {data.applied ? (
                    <View style={styles.appliedBanner}>
                      <View style={styles.appliedIconCircle}>
                        <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
                      </View>
                      <Text style={styles.appliedBannerText} numberOfLines={1}>
                        Joined with <Text style={{ fontFamily: fonts.bold }}>{data.applied.code}</Text> · ₹100 credit applied
                      </Text>
                    </View>
                  ) : null}

                  {/* Clean Friends List Card */}
                  <View style={styles.friendsHubCard}>
                    {data.history.length ? (
                      data.history.map((r, i) => {
                        const isInvited = r.status === 'invited';
                        const isPending = r.status === 'joined';
                        const isRewarded = r.status === 'rewarded';
                        const initials = r.name
                          .trim()
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();

                        const avatarStyle = isRewarded
                          ? { bg: '#EBF9F0', fg: '#15803D', badge: '#10B981', badgeIcon: 'check' as const }
                          : isPending
                            ? { bg: '#FFF4E8', fg: '#C2410C', badge: '#FFA742', badgeIcon: 'truck' as const }
                            : { bg: '#EEF3FB', fg: NAVY, badge: '#0A1C3E', badgeIcon: 'share' as const };

                        return (
                          <View key={r.id}>
                            {i > 0 && <View style={styles.friendRowDivider} />}
                            <View style={styles.friendRow}>
                              <FriendAvatarItem name={r.name} status={r.status} />

                              {/* Friend Details */}
                              <View style={styles.friendInfoCol}>
                                <Text style={styles.friendName}>{r.name}</Text>
                                <Text style={styles.friendDetail} numberOfLines={1}>
                                  {isInvited
                                    ? `Invite sent · ${shortDate(r.date)}`
                                    : isPending
                                      ? `Wash in progress · ${shortDate(r.date)}`
                                      : `Delivered · ${shortDate(r.date)}`}
                                </Text>
                              </View>

                              {/* Status Pill */}
                              {isInvited ? (
                                <View style={styles.invitedPill}>
                                  <Text style={styles.invitedPillText}>Invited</Text>
                                </View>
                              ) : isPending ? (
                                <View style={styles.pendingPill}>
                                  <Icon name="clock" size={10} color="#C2410C" strokeWidth={2.4} />
                                  <Text style={styles.pendingPillText}>₹200 Pending</Text>
                                </View>
                              ) : (
                                <View style={styles.rewardedPill}>
                                  <Icon name="check" size={10.5} color="#047857" strokeWidth={2.8} />
                                  <Text style={styles.rewardedPillText}>+₹200 Earned</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptyFriendsBox}>
                        <Text style={styles.emptyFriendsText}>
                          No invites yet. Share your pass code to start earning!
                        </Text>
                      </View>
                    )}

                    {/* Bottom encouraging footer note */}
                    <View style={styles.friendsCardFoot}>
                      <Icon name="sparkle" size={12} color="#FFA742" strokeWidth={2.2} />
                      <Text style={styles.friendsCardFootText}>
                        Invite more campus friends to earn ₹200 on every first wash.
                      </Text>
                    </View>
                  </View>
                </Rise>
              </View>
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* ── Collapsing Top Bar in matching warm beige tint ── */}
      <CollapsingBar
        bar={bar}
        tint={BEIGE_RGB}
        style={{ paddingTop: Math.max(insets.top, 6), paddingBottom: space.xs }}
      >
        <View style={styles.barInner}>
          <TopBar padded={false} leading="back" title="Refer & earn" />
        </View>
      </CollapsingBar>

      {/* ── Floating Action Buttons (Copy & Share) ── */}
      {data ? (
        <View
          style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 72 }]}
          pointerEvents="box-none"
        >
          <View style={styles.bottomFade} pointerEvents="none" />
          {shareNote ? <Text style={styles.note}>{shareNote}</Text> : null}
          <View style={styles.bottomRow}>
            <Button
              label={copied ? 'Code copied!' : 'Copy code'}
              variant={copied ? 'primary' : 'outline'}
              icon={copied ? 'check' : 'copy'}
              onPress={copy}
              style={[
                styles.bottomBtn,
                styles.copyBtnStyle,
                copied && styles.bottomBtnCopied,
                styles.topUpShadow,
              ]}
            />
            <Button
              label={data.applied ? 'ID Applied ✓' : 'Enter ID'}
              variant="dark"
              icon={data.applied ? 'check' : 'plus'}
              disabled={!!data.applied}
              onPress={() => setCodeOpen(true)}
              style={[styles.bottomBtn, styles.topUpShadow]}
            />
          </View>
        </View>
      ) : null}

      {/* ── Bottom Drawer for Applying Friend's Code ── */}
      <BottomSheet visible={codeOpen} onClose={() => setCodeOpen(false)}>
        {data ? (
          <ReferralCodeDrawer
            rules={data.rules}
            friendReward={data.rewardPerReferral}
            onApplied={() => {
              setCodeOpen(false);
              invalidate(keys.referrals);
            }}
          />
        ) : null}
      </BottomSheet>

      {/* Floating Bottom Navigation Bar */}
      <FloatingBottomBar />
    </View>
  );
}

/** Card deals in with a light drop and scale */
function Deal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.set(withDelay(delay, withSpring(1, { damping: 18, stiffness: 180, mass: 0.9 })));
  }, [delay, p, reduced]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 16 }, { scale: 0.96 + p.value * 0.04 }],
  }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

/** Section heading with title, optional count badge, and action */
function SectionHead({
  n,
  title,
  action,
}: {
  n?: number;
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.head}>
      {n !== undefined && n > 0 ? (
        <View style={styles.headDot}>
          <Text style={styles.headDotText}>{n}</Text>
        </View>
      ) : null}
      <Text style={styles.headTitle}>{title}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.headAction, webCursor, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.headActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Smooth animated collapse/expand container */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0);
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    p.set(
      reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 320, easing: EASE_OUT }),
    );
  }, [open, p, reduced]);
  const box = useAnimatedStyle(() => ({ height: h.value * p.value }));
  const inner = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5, 1], [0, 0.4, 1]),
    transform: [{ translateY: (1 - p.value) * -6 }],
  }));
  return (
    <Animated.View style={[styles.collapse, box]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        style={[styles.collapseInner, inner]}
        onLayout={(e) => h.set(e.nativeEvent.layout.height)}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** Rotating chevron matching SupportScreen */
function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.set(withSpring(open ? 1 : 0, { damping: 16, stiffness: 180 }));
  }, [open, r]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r.value * 180}deg` }],
    backgroundColor: interpolateColor(
      Math.min(1, Math.max(0, r.value)),
      [0, 1],
      ['#F4F1EA', '#0A1C3E'],
    ),
  }));
  return (
    <Animated.View style={[styles.chevron, anim]}>
      <Icon
        name="chevronDown"
        size={15}
        color={open ? '#FFFFFF' : '#0A1C3E'}
        strokeWidth={2.2}
      />
    </Animated.View>
  );
}

/** Interactive FAQ / How it works accordion item */
function AccordionItem({
  icon,
  title,
  content,
  open,
  onToggle,
  isFirst,
}: {
  icon?: IconName;
  title: string;
  content: string;
  open: boolean;
  onToggle: () => void;
  isFirst: boolean;
}) {
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.set(withTiming(open ? 1 : 0, { duration: 250 }));
  }, [open, t]);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['rgba(255,255,255,1)', '#FAF8F4']),
  }));

  return (
    <Animated.View style={[styles.accordionItem, !isFirst && styles.accordionBorder, bg]}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.accordionHead, webCursor]}
      >
        {icon ? (
          <View style={[styles.stepIcon, open && styles.stepIconOpen]}>
            <Icon
              name={icon}
              size={16}
              color={open ? colors.orange : NAVY}
              strokeWidth={2.3}
            />
          </View>
        ) : null}
        <Text style={[styles.accordionTitle, open && styles.accordionTitleOpen]}>{title}</Text>
        <Chevron open={open} />
      </Pressable>
      <Collapse open={open}>
        <View style={[styles.accordionBody, icon ? { paddingLeft: 52 } : { paddingLeft: 0 }]}>
          <Text style={styles.accordionContent}>{content}</Text>
        </View>
      </Collapse>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CANVAS },
  barInner: {
    paddingHorizontal: PAGE,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  page: {
    paddingHorizontal: PAGE,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },

  /* Top Beige Panel */
  panel: {
    backgroundColor: BEIGE,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 18,
    paddingBottom: 72,
  },
  panelInner: {
    paddingHorizontal: PAGE + 4,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hello: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1.1,
    color: NAVY,
  },
  helloOrange: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1.1,
    color: colors.orange,
  },
  helloSub: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(10,28,62,0.65)',
    marginTop: 6,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    justifyContent: 'center',
  },
  tagText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8, color: NAVY },

  cards: { marginTop: -46, gap: 14 },

  /* VIP Invitation Ticket Styles (Deep Navy Boarding Pass) */
  ticketContainer: {
    borderRadius: 24,
    alignSelf: 'center',
  },
  ticketTopBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketKicker: {
    fontFamily: fonts.bold,
    color: '#FFA742',
  },
  ticketVipBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketVipBadgeText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  ticketHeadline: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  ticketSubtext: {
    fontFamily: fonts.regular,
    color: 'rgba(255, 255, 255, 0.72)',
    lineHeight: 16,
  },
  ticketPerksStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketPerksText: {
    fontFamily: fonts.medium,
    color: '#FFA742',
    letterSpacing: 0.2,
  },
  ticketBottomStub: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ticketCodePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingLeft: 14,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' } as object)
      : { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 }),
  },
  ticketCodeText: {
    fontFamily: MONO,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 2,
  },
  ticketCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.orange,
  },
  ticketCopyBtnCopied: {
    backgroundColor: '#059669',
  },
  ticketCopyBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  ticketStubMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ticketStubMetaTop: {
    fontFamily: MONO,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
  },
  ticketStubMetaBtm: {
    fontFamily: fonts.bold,
    color: '#FFA742',
    letterSpacing: 0.6,
  },

  /* Stats Card Strip */
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4CFBF',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: NAVY,
    fontVariant: ['tabular-nums'],
  },
  statPending: {
    color: colors.orange,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 2,
  },
  statRule: {
    width: 1,
    height: 32,
    backgroundColor: '#F0ECE4',
  },

  /* Section Header */
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  headDot: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headDotText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },
  headTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, color: NAVY },
  headAction: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    justifyContent: 'center',
  },
  headActionText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8, color: NAVY },

  /* Steps & FAQ Accordion */
  stepsCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4CFBF',
    overflow: 'hidden',
  },
  accordionItem: {
    paddingHorizontal: 16,
  },
  accordionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F4F1EA',
  },
  accordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconOpen: {
    backgroundColor: '#FFF1E0',
  },
  accordionTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    lineHeight: 20,
    color: NAVY,
  },
  accordionTitleOpen: {
    fontFamily: fonts.bold,
    color: NAVY,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapse: {
    overflow: 'hidden',
  },
  collapseInner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  accordionBody: {
    paddingRight: 24,
    paddingBottom: 16,
  },
  accordionContent: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.inkSoft,
  },

  /* ── Clean Proper Friends Section ── */
  friendsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  friendsHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendsSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: NAVY,
    letterSpacing: -0.2,
  },
  friendsCountPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#F3F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsCountText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: NAVY,
  },
  haveCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E4DA',
  },
  haveCodeText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: NAVY,
  },

  appliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 10,
  },
  appliedIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: NAVY,
  },

  friendsHubCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4CFBF',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(10, 28, 62, 0.07), 0 1px 3px rgba(10, 28, 62, 0.04)',
        } as object)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  friendRowDivider: {
    height: 1,
    backgroundColor: '#F4F1EA',
    marginHorizontal: 16,
  },
  friendAvatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  friendAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#EAE4D8',
  },
  friendAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  friendAvatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  friendName: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: NAVY,
    letterSpacing: -0.2,
  },
  friendDetail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  invitedPill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9,
    backgroundColor: '#F1F3F7',
  },
  invitedPillText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: '#64748B',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pendingPillText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: '#C2410C',
  },
  rewardedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  rewardedPillText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#047857',
  },
  friendsCardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: '#FAF8F4',
    borderTopWidth: 1,
    borderTopColor: '#F4F1EA',
  },
  friendsCardFootText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 15,
  },
  emptyFriendsBox: {
    padding: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFriendsText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
  },

  /* Bottom Actions */
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 560 - space.lg * 2,
    width: '100%',
    alignSelf: 'center',
  },
  bottomBtn: { flex: 1 },
  copyBtnStyle: {
    borderColor: NAVY,
    borderWidth: 1.5,
  },
  bottomBtnCopied: {
    backgroundColor: '#0D7A21',
    borderColor: '#0D7A21',
  },
  topUpShadow:
    Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 4px 14px rgba(10, 28, 62, 0.12), 0 1px 3px rgba(10, 28, 62, 0.06)',
        } as object)
      : {
          shadowColor: '#0A1C3E',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        },
  bottomFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0), ${CANVAS} 35%)`,
        } as object)
      : { backgroundColor: 'rgba(255,255,255,0.96)' }),
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: space.sm,
  },
});
