import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Icon, type IconName } from "../../components/app/Icon";
import { Pop, Rise, RollingNumber } from "../../components/app/motion";
import { TopBar } from "../../components/app/TopBar";
import { Button } from "../../components/app/primitives";
import { EmptyState, ErrorState, Skeleton } from "../../components/app/states";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { haptic } from "../../lib/haptics";
import { money, monthLabel, when } from "../../lib/format";
import { invalidate, keys, triggerAppRefresh, useQuery } from "../../lib/query";
import { useWebDrag } from '../../lib/useWebDrag';
import {
  getCustomerProfile,
  getMembershipDetails,
} from "../../services/mock/profile.service";
import {
  demoTopUp,
  getWallet,
  topUpBonusFor,
} from "../../services/mock/account.service";
import { app, colors, fonts, space, text } from "../../theme";
import type {
  WalletConfig,
  WalletTxn,
  WalletTxnSource,
} from "../../types/models";

const webCursor =
  Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;
const SHEET_ID = "wallet-transactions-sheet"; // lets the web wheel listener find the sheet
const BRAND_RED = colors.navy; // the logo navy, as on the profile member card
const CANVAS = "#EAE6DB"; // the same stone beige as the coupons page
const CARD = "#FFFFFF"; // card body
const EDGE = "#ECEAE4"; // hairline edges on the off-white
const CHIP = "#F4F3EF";
const CHIP_ON = "#FFFFFF";
const CHIP_EDGE = "#C4BEAD";
const CHIP_ON_EDGE = colors.ink;
const GREEN = "#1F7A2E";
const PRESS_SPRING = { damping: 15, stiffness: 320 };

export function WalletScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740; // smaller disc so short phones fit everything without scrolling
  const wallet = useQuery(keys.wallet, getWallet);
  const profile = useQuery(keys.profile, getCustomerProfile);
  const membership = useQuery(keys.profileMembership, getMembershipDetails);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const handlePullRefresh = async () => {
    setPullRefreshing(true);
    haptic.tap();
    await triggerAppRefresh();
    setPullRefreshing(false);
  };
  const [adding, setAdding] = useState(false);
  const [heroH, setHeroH] = useState(0);

  const submitTopUp = async (amount: number) => {
    setAdding(true);
    await demoTopUp(amount);
    haptic.success();
    setAdding(false);
    setTopUpOpen(false);
    // refresh once the drawer has slid away, so the balance is seen rolling up
    setTimeout(() => invalidate(keys.wallet), 280);
  };

  const data = wallet.data;
  const transactions = data?.transactions ?? [];

  // the transactions sheet, like the coupons page: drag or tap its handle and it rises over the balance
  const lift = Math.round(Math.max(0, heroH - insets.top - 64) * 0.75);
  const pos = useSharedValue(0); // 0 = resting, 1 = raised
  const startPos = useSharedValue(0);
  const [isRaised, setIsRaised] = useState(false);
  const settle = (to: number) => {
    setIsRaised(to > 0.5);
    pos.set(withSpring(to, { damping: 22, stiffness: 240, mass: 0.8 }));
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        // take over from the handle's tap once it's clearly a drag
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          startPos.set(pos.value);
        },
        onPanResponderMove: (_, g) => {
          const p = startPos.value - g.dy / Math.max(lift, 1);
          pos.set(p < 0 ? p * 0.25 : p > 1 ? 1 + (p - 1) * 0.25 : p); // a little give past either end
        },
        onPanResponderRelease: (_, g) =>
          settle(g.vy < -0.3 ? 1 : g.vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
        onPanResponderTerminate: () => settle(pos.value > 0.5 ? 1 : 0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lift, pos],
  );
  // web: mouse and trackpad drags on the handle (the responder above only hears touch there)
  useWebDrag(
    'wallet-handle',
    {
      onStart: () => startPos.set(pos.value),
      onMove: (dy) => {
        const v = startPos.value - dy / Math.max(lift, 1);
        pos.set(v < 0 ? v * 0.25 : v > 1 ? 1 + (v - 1) * 0.25 : v);
      },
      onEnd: (vy) => settle(vy < -0.3 ? 1 : vy > 0.3 ? 0 : pos.value > 0.5 ? 1 : 0),
    },
    [heroH, lift],
  );
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pos.value * lift }],
  }));
  const listInset = useAnimatedStyle(() => ({
    marginBottom: (1 - Math.min(1, Math.max(0, pos.value))) * lift,
  }));
  const heroStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: 1 - t * 0.2, transform: [{ scale: 1 - t * 0.04 }] };
  });
  const backdropStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, pos.value));
    return { opacity: t * 0.52 };
  });
  const toggle = () => {
    haptic.tap();
    settle(pos.value > 0.5 ? 0 : 1);
  };
  const bottomGap = Math.max(insets.bottom, 12) + 68; // clear of the floating tab bar
  const listY = useRef(0);
  const onListScroll = (e: {
    nativeEvent: { contentOffset: { y: number } };
  }) => {
    listY.current = e.nativeEvent.contentOffset.y;
  };
  // touch: starting to scroll the list lifts the sheet; pulling down at the very top lowers it
  const onListDragEnd = (e: {
    nativeEvent: { contentOffset: { y: number }; velocity?: { y: number } };
  }) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y <= 0 && pos.value > 0.5 && (e.nativeEvent.velocity?.y ?? 0) < -0.2)
      settle(0);
  };
  const onListDragBegin = () => {
    if (pos.value < 0.5) settle(1);
  };

  // web: the wheel or trackpad does the same, then hands over to the list
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const node = document.getElementById(SHEET_ID);
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return;
      const raised = pos.value > 0.5;
      if (e.deltaY > 0 && !raised) {
        e.preventDefault();
        settle(1);
      } else if (e.deltaY < 0 && raised && listY.current <= 0) {
        e.preventDefault();
        settle(0);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroH, lift]);

  return (
    <View style={styles.root}>
      {/* balance up top on the beige */}
      <Animated.View
        style={[
          styles.page,
          { paddingTop: Math.max(insets.top, 6) },
          heroStyle,
        ]}
        onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}
      >
        {/* the app's shared top bar */}
        <Rise distance={8}>
          <TopBar padded={false} title="Wallet" />
        </Rise>

        {wallet.loading ? (
          <View style={styles.cardsWrap}>
            <Skeleton height={compact ? 174 : 188} radius={24} />
          </View>
        ) : wallet.error || !data ? (
          <ErrorState onRetry={wallet.refetch} />
        ) : (
          <>
            <BalanceCards
              balance={data.balance}
              name={profile.data?.fullName}
              walletNo={profile.data?.id.replace(/\D/g, "").slice(-4)}
              since={profile.data?.customerSince}
              referral={membership.data?.referralCode}
              compact={compact}
              onHistory={toggle}
              onRefer={() => navigation.navigate("Refer")}
            />
          </>
        )}
      </Animated.View>

      {/* Dimming backdrop behind the sheet when scrolled/raised */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={isRaised ? "auto" : "none"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => settle(0)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss transactions"
        />
      </Animated.View>

      {/* the transactions sheet: white, rounded on top, every transaction scrolling inside */}
      {heroH ? (
        <Animated.View
          nativeID={SHEET_ID}
          style={[
            styles.sheet,
            { top: heroH + space.md, bottom: -lift },
            sheetStyle,
          ]}
        >
          <View nativeID="wallet-handle" {...pan.panHandlers}>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel="Show more or fewer transactions"
              hitSlop={10}
              style={[styles.handleHit, webCursor]}
            >
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Transactions</Text>
              <Text style={styles.sheetCount}>{transactions.length}</Text>
            </View>
          </View>
          {/* the part of the sheet still below the screen is trimmed off, so the list always ends just above Top Up */}
          <Animated.View style={[styles.fill, listInset]}>
            <ScrollView
              style={styles.fill}
              onScroll={onListScroll}
              onScrollBeginDrag={onListDragBegin}
              onScrollEndDrag={onListDragEnd}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: space.xl,
                paddingBottom: bottomGap + 88,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={pullRefreshing}
                  onRefresh={handlePullRefresh}
                  tintColor={colors.orange}
                  colors={[colors.orange, colors.navy]}
                />
              }
            >
              {wallet.loading ? (
                <Skeleton height={200} radius={16} />
              ) : transactions.length ? (
                <>
                  <TxnList txns={transactions} delay={260} step={60} />
                  <Rise delay={260 + (transactions.length + 3) * 60} distance={6} style={styles.end}>
                    <Text style={styles.endText}>End of transactions</Text>
                  </Rise>
                </>
              ) : (
                <EmptyState
                  icon="wallet"
                  title="No transactions yet"
                  message="Top-ups, payments and refunds will show up here."
                />
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Top Up stays put, above the tab bar; the list fades out beneath it */}
      <View
        style={[styles.bottom, { paddingBottom: bottomGap }]}
        pointerEvents="box-none"
      >
        <View style={styles.bottomFade} pointerEvents="none" />
        <Rise delay={160} distance={24}>
          <Button
            label="Top Up"
            variant="dark"
            icon="plus"
            disabled={!data}
            onPress={() => setTopUpOpen(true)}
            style={styles.topUp}
          />
        </Rise>
      </View>

      <BottomSheet
        visible={topUpOpen}
        onClose={() => !adding && setTopUpOpen(false)}
      >
        {data ? (
          <TopUpForm
            balance={data.balance}
            config={data.config}
            adding={adding}
            onSubmit={submitTopUp}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

/** The drawer where the amount is chosen. Remounts on every open, so it always starts fresh. */
function TopUpForm({
  balance,
  config,
  adding,
  onSubmit,
}: {
  balance: number;
  config: WalletConfig;
  adding: boolean;
  onSubmit: (amount: number) => void;
}) {
  const defaultAmount = config.presets[0] ?? 100;
  const [value, setValue] = useState(String(defaultAmount));
  const [focused, setFocused] = useState(false);

  const amount = Number(value) || 0;
  const tooSmall = amount < config.limits.min;
  const tooBig = amount > config.limits.max;
  const valid = !tooSmall && !tooBig && value.trim().length > 0;
  const bonus = valid ? topUpBonusFor(amount, config) : 0;

  return (
    <View>
      <Text style={text.h1}>Add money</Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>
        Pick an amount or type your own.
      </Text>

      <View style={styles.chips}>
        {config.presets.map((p, i) => (
          <AmountChip
            key={p}
            value={p}
            selected={amount === p}
            delay={90 + i * 50}
            onPress={() => {
              haptic.tap();
              setValue(String(p));
            }}
          />
        ))}
      </View>

      <Rise delay={300}>
        <View
          style={[
            styles.amountField,
            focused && styles.amountFieldFocus,
            !valid && value.length > 0 && styles.amountFieldError,
          ]}
        >
          <TextInput
            value={value}
            onChangeText={(t) =>
              setValue(t.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6))
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Add Amount"
            placeholderTextColor={colors.inkMuted}
            keyboardType="number-pad"
            accessibilityLabel="Add amount in rupees"
            selectionColor={colors.navy}
            style={[
              styles.amountInput,
              Platform.OS === "web" && ({ outlineStyle: "none" } as object),
            ]}
          />
          <View style={styles.amountDivider} />
          <View style={styles.amountRupeeBadge}>
            <Text style={styles.amountRupeeText}>₹</Text>
          </View>
        </View>
        <Text style={[styles.helper, !valid && value.length > 0 && { color: colors.danger }]}>
          {tooSmall
            ? `Minimum top-up is ${money(config.limits.min)}.`
            : tooBig
              ? `Maximum top-up is ${money(config.limits.max)}.`
              : bonus
                ? `You'll get ${money(bonus)} extra (${config.topUpBonus.percent}% bonus).`
                : `Add ${money(config.topUpBonus.minAmount)} or more for ${config.topUpBonus.percent}% extra.`}
        </Text>
      </Rise>

      <Rise delay={360} style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={text.label}>New balance</Text>
          <Text style={text.caption}>
            {valid
              ? `${money(balance)} + ${money(amount + bonus)}`
              : `${money(balance)} now`}
          </Text>
        </View>
        <RollingNumber
          value={balance + (valid ? amount + bonus : 0)}
          style={styles.summaryAmount}
        />
      </Rise>

      <Rise delay={420} style={{ marginTop: space.lg }}>
        <Button
          label={valid ? `Top Up ${money(amount)}` : "Enter a valid amount"}
          variant="dark"
          icon="plus"
          disabled={!valid}
          loading={adding}
          onPress={() => onSubmit(amount)}
        />
      </Rise>
    </View>
  );
}

/** Quick amount: colour eases between states, it squeezes on press, and the ₹ dot pops in when chosen. */
function AmountChip({
  value,
  selected,
  delay,
  onPress,
}: {
  value: number;
  selected: boolean;
  delay: number;
  onPress: () => void;
}) {
  const sel = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    sel.value = withTiming(selected ? 1 : 0, { duration: 240 });
  }, [sel, selected]);
  const anim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(sel.value, [0, 1], [CHIP, CHIP_ON]),
    borderColor: interpolateColor(sel.value, [0, 1], [CHIP_EDGE, CHIP_ON_EDGE]),
    transform: [{ scale: press.value }],
  }));

  const num = money(value).replace('₹', '');

  return (
    <Rise delay={delay} style={styles.chipSlot}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press.set(withSpring(0.93, PRESS_SPRING))}
        onPressOut={() => press.set(withSpring(1, PRESS_SPRING))}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={money(value)}
        style={webCursor}
      >
        <Animated.View style={[styles.chip, anim]}>
          {selected ? (
            <View style={styles.chipDot}>
              <Text style={styles.chipDotText}>₹</Text>
            </View>
          ) : null}
          <Text
            style={[styles.chipText, selected && styles.chipTextOn]}
            numberOfLines={1}
          >
            {selected ? num : money(value)}
          </Text>
        </Animated.View>
      </Pressable>
    </Rise>
  );
}

const FRONT = { radius: 24, notchW: 116, notchH: 48, gap: 6 };

/**
 * The front card's outline: a rounded card with its bottom-right corner cut away for the button. The notch's
 * curves are the button's radius plus the gap, so the button sits in it with an even ring all the way round.
 */
function frontPath(w: number, h: number) {
  const { radius: r, notchW: nw, notchH: nh, gap } = FRONT;
  const pill = (nh - gap) / 2; // the button is a full pill
  const ring = pill + gap; // so the notch hugs it at an even distance
  const tail = Math.min(r, nh - ring); // the corner where the name strip ends
  const x = w - nw;
  const y = h - nh;
  return [
    `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}`,
    `V${y - ring}A${ring} ${ring} 0 0 1 ${w - ring} ${y}`,
    `H${x + ring}A${ring} ${ring} 0 0 0 ${x} ${y + ring}`,
    `V${h - tail}A${tail} ${tail} 0 0 1 ${x - tail} ${h}`,
    `H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`,
  ].join("");
}

/**
 * Two stacked cards in the logo colours: the red one peeking out behind, the yellow wallet card in front with the
 * balance rolling in, and a notch cut into its corner that holds the history button.
 */
function BalanceCards({
  balance,
  name,
  walletNo,
  since,
  referral,
  compact,
  onHistory,
  onRefer,
}: {
  balance: number;
  name?: string;
  walletNo?: string;
  since?: string;
  referral?: string;
  compact: boolean;
  onHistory: () => void;
  onRefer: () => void;
}) {
  const prev = useRef(balance);
  const [delta, setDelta] = useState<{ value: number; id: number } | null>(
    null,
  );
  const { width: screenW } = useWindowDimensions();
  const [w, setW] = useState(Math.round(screenW - space.lg * 2));

  // entrance: the yellow card lands first, then the red one slides up from behind it
  const reduced = useReducedMotion();
  const front = useSharedValue(reduced ? 1 : 0);
  const back = useSharedValue(reduced ? 1 : 0);
  // replays every time the wallet tab is opened, not just the first time
  const focused = useIsFocused();
  useEffect(() => {
    if (reduced || !focused) return;
    front.set(0);
    back.set(0);
    // the yellow card eases up into place; then the red one rises slowly, at an even pace, from behind it
    front.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    back.set(withDelay(380, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) })));
  }, [front, back, reduced, focused]);
  const frontStyle = useAnimatedStyle(() => {
    const t = front.value;
    return {
      opacity: Math.min(1, t * 1.6),
      transform: [{ translateY: (1 - t) * 34 }, { scale: 0.96 + 0.04 * t }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const t = back.value;
    return {
      opacity: t > 0 ? 1 : 0,
      transform: [{ translateY: (1 - t) * 64 }],
    };
  });
  useEffect(() => {
    if (balance === prev.current) return;
    setDelta({ value: balance - prev.current, id: Date.now() });
    prev.current = balance;
  }, [balance]);

  const len = money(balance).length;
  const size = Math.round(
    (len <= 6 ? 34 : len <= 8 ? 30 : 26) * (compact ? 0.92 : 1),
  );
  const h = compact ? 174 : 188;
  const sinceLabel = since
    ? `${since.slice(5, 7)}/${since.slice(2, 4)}`
    : "--/--";

  return (
    <View style={styles.cardsWrap}>
      {/* the red card behind */}
      <Animated.View style={backStyle}>
        <Pressable
          onPress={onRefer}
          accessibilityRole="button"
          accessibilityLabel={`Refer and earn${referral ? `, your code ${referral}` : ""}`}
          style={({ pressed }) => [
            styles.backCard,
            webCursor,
            pressed && { opacity: 0.92 },
          ]}
        >
          <View style={styles.backLeft}>
            <View style={styles.backIcon}>
              <Icon name="gift" size={13} color={BRAND_RED} strokeWidth={2.4} />
            </View>
            <Text style={styles.backTitle}>Refer & earn</Text>
          </View>
          <View style={styles.backLeft}>
            <Text style={styles.backNumber}>
              {referral ?? "\u2022\u2022\u2022\u2022"}
            </Text>
            <Icon
              name="chevronRight"
              size={16}
              color="#FFFFFF"
              strokeWidth={2.4}
            />
          </View>
        </Pressable>
      </Animated.View>

      {/* the yellow wallet card, drawn as one shape so the notch has soft curves */}
      <Animated.View style={[{ height: h, marginTop: -24 }, frontStyle]}>
        <View
          style={styles.frontShape}
          onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
          pointerEvents="none"
        >
          {w ? (
            <Svg width={w} height={h}>
              <Path d={frontPath(w, h)} fill={app.yellow} />
            </Svg>
          ) : null}
        </View>

        <View style={[styles.frontBody, { height: h - FRONT.notchH }]}>
          <View style={styles.frontRow}>
            <View style={styles.frontIcon}>
              <Icon
                name="wallet"
                size={15}
                color={app.yellow}
                strokeWidth={2.2}
              />
            </View>
            <Text style={styles.frontNumber}>
              {"\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  "}
              {walletNo ?? "\u2022\u2022\u2022\u2022"}
            </Text>
          </View>
          <View style={styles.frontMid}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.frontLabel, { marginBottom: 2 }]}>
                Balance
              </Text>
              <RollingNumber
                value={balance}
                style={{
                  ...styles.frontBalance,
                  fontSize: size,
                  lineHeight: Math.round(size * 1.18),
                }}
                delay={300}
              />
            </View>
            <View style={styles.frontSide}>
              <Text style={styles.frontLabel}>Member since</Text>
              <Text style={styles.frontSideValue}>{sinceLabel}</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.frontName,
            { right: FRONT.notchW + 12, height: FRONT.notchH },
          ]}
        >
          <Text style={styles.frontLabel}>Name</Text>
          <Text style={styles.frontNameText} numberOfLines={1}>
            {name ?? "Your wallet"}
          </Text>
        </View>

        {/* the button sitting in the notch, in the same charcoal as Top Up */}
        <Pressable
          onPress={onHistory}
          accessibilityRole="button"
          accessibilityLabel="Show all transactions"
          style={({ pressed }) => [
            styles.notchPill,
            {
              width: FRONT.notchW - FRONT.gap,
              height: FRONT.notchH - FRONT.gap,
            },
            webCursor,
            pressed && { opacity: 0.88 },
          ]}
        >
          <View style={styles.notchIcon}>
            <Icon name="receipt" size={14} color="#0A1C3E" strokeWidth={2.2} />
          </View>
          <Text style={styles.notchText}>History</Text>
        </Pressable>
      </Animated.View>
      {delta ? <DeltaFloat key={delta.id} value={delta.value} /> : null}
    </View>
  );
}

/** "+₹2,100" or "−₹444" that rises out of the disc and fades away. */
function DeltaFloat({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = reduced
      ? withSequence(
          withTiming(0.4, { duration: 0 }),
          withDelay(1600, withTiming(1, { duration: 0 })),
        )
      : withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) });
  }, [t, reduced]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(t.value, [0, 1], [24, -18]) },
      { scale: interpolate(t.value, [0, 0.12], [0.7, 1], Extrapolation.CLAMP) },
    ],
  }));
  const up = value > 0;
  return (
    <View style={styles.deltaWrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.delta,
          { backgroundColor: up ? colors.successTint : colors.dangerTint },
          anim,
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.deltaText, { color: up ? GREEN : colors.danger }]}>
          {up ? "+" : "−"}
          {money(Math.abs(value))}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Each kind of entry gets its own icon and tint, so the list reads at a glance. */
const LOOK: Record<
  WalletTxnSource,
  { icon: IconName; bg: string; fg: string }
> = {
  topup: { icon: "wallet", bg: colors.successTint, fg: "#0D7A21" },
  referral: { icon: "gift", bg: colors.successTint, fg: "#0D7A21" },
  bonus: { icon: "sparkle", bg: app.warningTint, fg: app.warning },
  order: { icon: "bag", bg: "#EEF0F3", fg: colors.inkSoft },
  refund: { icon: "refresh", bg: app.navySoft, fg: colors.navy },
};
const lookFor = (t: WalletTxn) =>
  LOOK[
    t.source ??
      (t.type === "debit" ? "order" : t.type === "refund" ? "refund" : "topup")
  ];

function cleanTxnTitle(txn: WalletTxn): string {
  if (txn.orderId && txn.type === "debit") return `Order #${txn.orderId}`;
  if (txn.orderId && txn.type === "refund") return `Refund · #${txn.orderId}`;
  return txn.title
    .replace(/^Paid for order (WB\d+)/, "Order #$1")
    .replace(/^Delivery fee refunded · (WB\d+)/, "Refund · #$1")
    .replace(/^Added to wallet via /, "Added via ")
    .replace(/^Referral reward · /, "Referral · ")
    .replace(/^Top-up bonus · .*$/, "Top-up bonus")
    .replace(/^Welcome bonus · .*$/, "Welcome bonus");
}

function cleanWhen(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfNow - startOfD) / 86400000);

  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const t = `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (days === 0) return `Today, ${t}`;
  if (days === 1) return `Yesterday, ${t}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${t}`;
}

/** Transactions under month headings (November, October…), newest first, entrances staggered across groups. */
function TxnList({
  txns,
  delay = 0,
  step = 60,
  keyPrefix = "",
}: {
  txns: WalletTxn[];
  delay?: number;
  step?: number;
  keyPrefix?: string;
}) {
  const groups: {
    label: string;
    items: { txn: WalletTxn; index: number }[];
  }[] = [];
  txns.forEach((txn, index) => {
    const label = monthLabel(txn.date);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push({ txn, index });
    else groups.push({ label, items: [{ txn, index }] });
  });
  return (
    <>
      {groups.map((g, gi) => (
        <View key={keyPrefix + g.label}>
          <Rise
            delay={delay + (g.items[0].index + gi) * step}
            distance={6}
            style={[styles.groupHead, gi === 0 && { marginTop: space.sm }]}
          >
            <Text style={styles.groupLabel} accessibilityRole="header">
              {g.label}
            </Text>
          </Rise>
          {g.items.map(({ txn, index }, i) => (
            <TxnRow
              key={keyPrefix + txn.id}
              txn={txn}
              divider={i > 0}
              delay={delay + (index + gi + 1) * step}
            />
          ))}
        </View>
      ))}
    </>
  );
}

function TxnRow({
  txn,
  divider,
  delay = 0,
}: {
  txn: WalletTxn;
  divider?: boolean;
  delay?: number;
}) {
  const incoming = txn.type !== "debit";
  const pending = txn.status === "pending";
  const look = lookFor(txn);
  const at = cleanWhen(txn.date);
  const title = cleanTxnTitle(txn);
  return (
    <Rise delay={delay} distance={10} style={divider && styles.txnDivider}>
      <View
        style={styles.txn}
        accessible
        accessibilityLabel={`${title}, ${incoming ? "received" : "paid"} ${money(txn.amount)}, ${at}${pending ? ", pending" : ""}`}
      >
        <View style={[styles.txnIcon, { backgroundColor: look.bg }]}>
          <Icon name={look.icon} size={16} color={look.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.txnTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.when} numberOfLines={1}>
            {at}
          </Text>
        </View>
        <View style={styles.txnRight}>
          <Text
            style={[
              styles.txnAmount,
              { color: incoming ? "#0D7A21" : colors.ink },
            ]}
          >
            {incoming ? "+" : "−"}
            {money(txn.amount)}
          </Text>
          {pending ? (
            <View style={styles.pending}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CANVAS },
  backdrop: {
    backgroundColor: "#181410",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: "#E8E4DA",
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0 -4px 16px rgba(0, 0, 0, 0.04), 0 -1px 3px rgba(0, 0, 0, 0.02)",
        } as object)
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 4,
        }),
  },
  topUp:
    Platform.OS === "web"
      ? ({
          boxShadow:
            "0 4px 12px rgba(10, 28, 62, 0.12), 0 1px 3px rgba(10, 28, 62, 0.06)",
        } as object)
      : {
          shadowColor: "#0A1C3E",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        },
  handleHit: {
    alignSelf: "center",
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D5D9E0" },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  sheetCount: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
    backgroundColor: "#F1EFEA",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
  },
  bottomFade: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF 45%)",
        } as object)
      : { backgroundColor: "rgba(255,255,255,0.92)" }),
  },
  page: { paddingHorizontal: space.lg },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
  },

  discWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
    marginBottom: 2,
  },
  halo: {
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0 4px 16px rgba(60, 45, 20, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        } as object)
      : {
          shadowColor: "#0A1C3E",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
          elevation: 2,
        }),
    alignItems: "center",
    justifyContent: "center",
  },
  disc: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)",
        } as object)
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  balance: {
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkSoft,
    marginTop: 2,
  },
  flow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    marginTop: space.sm,
    marginBottom: 4,
  },
  flowItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  flowDot: { width: 7, height: 7, borderRadius: 4 },
  flowAmount: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  flowLabel: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.inkSoft,
  },
  flowDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(20, 33, 61, 0.18)",
  },
  cardsWrap: { marginTop: space.md, marginBottom: 0 },
  backCard: {
    height: 68,
    borderRadius: 24,
    backgroundColor: BRAND_RED,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: 12,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 4px 12px rgba(1, 42, 92, 0.08)" } as object)
      : {
          shadowColor: "#780A14",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  backIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  backLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backTitle: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },
  backNumber: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: 1.2,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  frontShape: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === "web"
      ? ({
          filter: "drop-shadow(0 4px 10px rgba(60, 45, 20, 0.06))",
        } as object)
      : {
          shadowColor: "#0A1C3E",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  frontBody: { paddingHorizontal: space.xl, paddingTop: 18 },
  frontRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  frontIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0A1C3E",
    alignItems: "center",
    justifyContent: "center",
  },
  frontNumber: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: 1.2,
    color: "#0A1C3E",
  },
  frontMid: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: "auto",
    paddingBottom: 6,
  },
  frontLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "rgba(10, 28, 62, 0.66)",
  },
  frontBalance: {
    fontFamily: fonts.bold,
    letterSpacing: -1,
    color: "#0A1C3E",
    fontVariant: ["tabular-nums"],
  },
  frontSide: { alignItems: "flex-end", paddingBottom: 6 },
  frontSideValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#0A1C3E",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  frontName: {
    position: "absolute",
    left: space.xl,
    bottom: 0,
    justifyContent: "center",
  },
  frontNameText: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: "#0A1C3E",
    marginTop: 2,
  },
  notchPill: {
    position: "absolute",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 7,
    borderRadius: (FRONT.notchH - FRONT.gap) / 2,
    backgroundColor: "#0A1C3E",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 3px 8px rgba(10, 28, 62, 0.08)",
        } as object)
      : {
          shadowColor: "#0A1C3E",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  notchIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  notchText: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#FFFFFF" },
  deltaWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  delta: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: "center",
  },
  deltaText: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    fontVariant: ["tabular-nums"],
  },

  cardWrap: { position: "relative", flex: 1 },
  cardBadgeWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  cardBadge: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0 4px 14px rgba(20, 33, 61, 0.18)",
        } as object)
      : {
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  cardBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },
  cardBody: {
    flex: 1, // fills the space left on screen; its list scrolls inside
    marginTop: 24,
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: EDGE,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    zIndex: 2,
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0 12px 32px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)",
        } as object)
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.07,
          shadowRadius: 20,
          elevation: 5,
        }),
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: app.hairline,
  },
  seeAllText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.navy },
  groupHead: {
    marginTop: space.lg,
    marginBottom: 4,
  },
  groupLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  end: { alignItems: "center", justifyContent: "center", marginTop: space.xl, paddingBottom: space.md },
  endText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.inkMuted, opacity: 0.6 },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 12,
  },
  txnDivider: { borderTopWidth: 1, borderTopColor: "#F2EFEB" },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txnTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  when: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  txnRight: { alignItems: "flex-end", gap: 3 },
  txnAmount: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 19,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: app.warningTint,
  },
  pendingDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: app.warning,
  },
  pendingText: { fontFamily: fonts.semibold, fontSize: 10.5, color: app.warning },

  chips: { flexDirection: "row", gap: 6, marginTop: space.lg },
  chipSlot: { flex: 1 },
  chip: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  chipDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  chipDotText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    lineHeight: 13,
    color: "#FFFFFF",
    textAlign: "center",
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  chipTextOn: { fontFamily: fonts.semibold },
  amountField: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F4F2EB",
    marginTop: space.lg,
    paddingLeft: space.xl,
    paddingRight: space.lg,
    borderWidth: 1.25,
    borderColor: CHIP_EDGE,
  },
  amountFieldFocus: { backgroundColor: "#FFFFFF", borderColor: colors.ink },
  amountFieldError: { borderColor: colors.danger },
  amountInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  amountDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.lineStrong,
    marginHorizontal: space.md,
  },
  amountRupeeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRupeeText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  helper: {
    ...text.caption,
    color: colors.inkSoft,
    marginTop: space.sm,
    paddingHorizontal: space.sm,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 18,
    backgroundColor: "#F7F6F3",
    borderWidth: 1,
    borderColor: CHIP_EDGE,
  },
  summaryAmount: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: space.md,
  },
  filterPill: {
    flex: 1,
    paddingHorizontal: 0,
    height: 38,
  },
  emptyFill: { flexGrow: 1, justifyContent: "center" },
});
