import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Keyboard, KeyboardEvent, Platform, Pressable, StyleSheet, Text, TextInput, TextInputInstance, useWindowDimensions, View } from 'react-native';
import { useAnimatedKeyboardSafe } from '../hooks/useAnimatedKeyboardSafe';
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rise } from '../components/app/motion';
import { Button } from '../components/app/primitives';
import { DetailsStep, OtpStep, PhoneStep, PincodeStep, SheetSuccess, type Challenge } from '../components/auth/SignInSteps';
import { StoryHero } from '../components/auth/StoryHero';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Icon } from '../components/app/Icon';
import { haptic } from '../lib/haptics';
import { getCampusLogo } from '../laundry/campusLogos';
import { signIn as staffSignIn } from '../mock/services/staffService';
import type { Location } from '../mock/types';
import { useSession } from '../session/session';
import { app, colors, fonts, radius, space, text } from '../theme';

const UNAVAILABLE_ART = require('../../assets/illustrations/unavailable-map-pin.png');
const UNAVAILABLE_ASPECT = 839 / 641;
/** How long the green "done" moment holds before the next step takes over. */
const SUCCESS_HOLD_MS = 1300;

/** How far the sign-in sheet rises over the bottom of the film. */
const SHEET_OVERLAP = 28;
/** The film never shrinks below this; only very short screens scroll. */
const MIN_HERO = 150;
const SHEET_PAD_TOP = 24;
/** The sheet is not draggable, so it has no grab handle. */
const HANDLE_BLOCK = 0;
/** A long, soft ease-out: movements start promptly and settle gently, never snap. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const LIFT_MS = 560;


/**
 * Sign-in and setup on one page: the film above, one sheet below. The sheet shows whichever step
 * the customer is on (mobile number, code, details, PIN code), all in the drawer form style.
 */
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const { session, signIn, signOut, completeProfile, completePincode, completeStaffSignIn, continueAsGuest } = useSession();

  // One column: full-bleed on phones, a centred card column on tablets and desktop web.
  const wide = winW >= 640;
  const colW = wide ? Math.min(winW - 48, 440) : winW;
  const colLeft = (winW - colW) / 2;
  const heroTop = wide ? insets.top + 24 : 0;

  // The sheet takes the height its content needs and always sits on the bottom edge; the film
  // fills the space above it. On phones the film may grow past its own shape (StoryHero trims
  // its sides) so a short step never leaves an empty strip under the sheet, which showed up as
  // a gap between the form and the keyboard. On wide screens the film keeps its shape.
  // On short screens the film gives way, never the form.
  const filmH = Math.round((colW * 1612) / 1200);
  const [contentH, setContentH] = useState(0);
  const sheetH = (contentH || 400) + SHEET_PAD_TOP + HANDLE_BLOCK + insets.bottom + 14;
  const roomAbove = winH - heroTop - sheetH + SHEET_OVERLAP;
  const spaceH = Math.round(Math.max(MIN_HERO - SHEET_OVERLAP, wide ? Math.min(filmH - SHEET_OVERLAP, roomAbove) : roomAbove));

  // ---- Step: worked out from the session, so a refresh resumes exactly where the customer was ----
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  // the sheet keeps the height of the step that just finished, so the tick never leaves a gap
  const [success, setSuccess] = useState<{ title: string; message: string; height: number } | null>(null);
  const [unavailable, setUnavailable] = useState<{ pin: string; active: Location[] } | null>(null);
  const [pickedPin, setPickedPin] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(0);
  const step = !session
    ? challenge
      ? 'otp'
      : 'phone'
    : session.role === 'staff'
      ? 'staff'
      : session.stage === 'PHONE_VERIFIED' || editingDetails
        ? 'details'
        : 'pincode';

  // The "not here yet" drawer and the keyboard never move at the same time: the drawer opens once the keyboard
  // has gone down, and the fresh PIN field (which brings the keyboard back) only appears once the drawer is gone.
  const DRAWER_OUT_MS = 320;
  const showUnavailable = (pin: string, active: Location[]) => {
    if (Platform.OS === 'web' || !keyboardUp.current) {
      Keyboard.dismiss();
      setUnavailable({ pin, active });
      return;
    }
    let done = false;
    const open = () => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(fallback);
      Keyboard.dismiss(); // nothing in this drawer takes typing
      setUnavailable({ pin, active });
    };
    const sub = Keyboard.addListener('keyboardDidHide', open);
    const fallback = setTimeout(open, 450);
    Keyboard.dismiss();
  };
  const tryAnotherPin = () => {
    setUnavailable(null);
    setPickedPin(null);
    setTimeout(() => setPinReset((n) => n + 1), DRAWER_OUT_MS);
  };
  const chooseLocation = (loc: Location) => {
    haptic.tap();
    setUnavailable(null);
    setPickedPin(loc.pincode);
    setTimeout(() => setPinReset((n) => n + 1), DRAWER_OUT_MS);
  };

  // ---- Keyboard: stays up from the first digit to the last step ----
  // Each step has its own field, and when a focused field leaves the screen iOS and Android put
  // the keyboard away, only for the next step to bring it back. Just before a step changes, focus
  // moves to this invisible field, which holds the keyboard until the next step's field takes it.
  const keeper = useRef<TextInputInstance>(null);
  const holdKeyboard = () => {
    if (Platform.OS === 'web' || !keyboardUp.current) return;
    keeper.current?.focus();
  };

  // the green moment holds (keyboard still up), then the next step (or the app) takes over
  const celebrate = (title: string, message: string, then: () => Promise<void> | void, last = false) => {
    holdKeyboard();
    setSuccess({ title, message, height: contentH });
    setTimeout(async () => {
      if (last) Keyboard.dismiss(); // nothing left to type: the app opens without a keyboard
      await then();
      setSuccess(null);
    }, SUCCESS_HOLD_MS);
  };

  // ---- Lift: the sheet glides up over the film while typing; the film dims and recedes ----
  const topLimit = insets.top + 60; // never cover the Skip button
  const maxLift = Math.max(0, spaceH + heroTop - topLimit);
  const lift = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const progress = useDerivedValue(() =>
    Math.min(1, Math.max(lift.value / Math.max(maxLift, 1), scrollY.value / Math.max(spaceH * 0.7, 1))),
  );
  // Phones: follow the keyboard's real height frame by frame, so the form always sits right on top of it,
  // including when the keyboard changes size between steps.
  // On iOS the window does not resize so lift translates the sheet up over the keyboard.
  // On Android the window already resizes via adjustResize, so a large lift causes double-shifting;
  // keep lift gentle on Android so touch hitboxes stay perfectly aligned with the buttons.
  const kb = useAnimatedKeyboardSafe();
  const bottomInset = insets.bottom;
  const isAndroid = Platform.OS === 'android';
  useAnimatedReaction(
    () => kb.height.value,
    (h) => {
      if (Platform.OS === 'web') return;
      if (isAndroid) {
        // Android window resizes automatically; prevent off-screen over-translation
        lift.value = 0;
      } else {
        lift.value = Math.min(Math.max(0, h - bottomInset), maxLift);
      }
    },
    [bottomInset, maxLift, isAndroid],
  );
  const raise = useCallback(
    (to: number, duration = LIFT_MS) => {
      if (Platform.OS !== 'web') return; // phones follow the keyboard directly (above)
      const target = Math.min(to, maxLift);
      lift.set(reducedMotion ? target : withTiming(target, { duration, easing: EASE }));
    },
    [lift, maxLift, reducedMotion],
  );

  // On phones the real keyboard drives the lift, in step with its own animation.
  const keyboardUp = useRef(false);
  // a step that opens while the keyboard is up takes it over straight away
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e: KeyboardEvent) => {
      keyboardUp.current = true;
      setKeyboardShown(true);
      // the sheet's bottom padding already includes the home-indicator area, which the keyboard
      // covers, so lift by the rest: the form then sits just above the keys with no gap
      raise(Math.max(0, e.endCoordinates.height - insets.bottom), Math.max(e.duration || 0, LIFT_MS));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e: KeyboardEvent) => {
      keyboardUp.current = false;
      setKeyboardShown(false);
      raise(0, Math.max(e.duration || 0, LIFT_MS - 80));
    });
    // iOS: switching fields can swap keyboards of different heights (the details keyboard with
    // its suggestion bar is taller than the PIN number pad) without a hide, so follow every
    // frame change; otherwise the form would stay lifted for the taller one and leave a gap
    const frame = ios
      ? Keyboard.addListener('keyboardWillChangeFrame', (e: KeyboardEvent) => {
          if (!keyboardUp.current) return;
          const covered = Math.max(0, Dimensions.get('window').height - e.endCoordinates.screenY);
          if (covered > 0) raise(Math.max(0, covered - insets.bottom), Math.max(e.duration || 0, 250));
        })
      : null;
    return () => {
      show.remove();
      hide.remove();
      frame?.remove();
    };
  }, [raise, insets.bottom]);

  const dismiss = () => {
    Keyboard.dismiss();
    raise(0);
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }));
  const filmStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -18]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.04]) },
    ],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.55]) }));

  // Light status bar over the film; dark everywhere else.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(wide ? 'dark' : 'light');
      return () => setStatusBarStyle('dark');
    }, [wide]),
  );

  return (
    <View style={styles.root}>
      {/* Fixed layer: the film stays put; the sheet moves over it. */}
      <View
        style={[styles.hero, { left: colLeft, top: heroTop, width: colW, borderRadius: wide ? 24 : 0 }]}
        pointerEvents="none"
      >
        <Animated.View style={filmStyle}>
          <StoryHero width={colW} height={spaceH + SHEET_OVERLAP} playing={focused} still={reducedMotion} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      </View>

      <Animated.ScrollView
        style={[styles.flex, sheetStyle]}
        contentContainerStyle={[styles.content, { paddingTop: heroTop }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        {/* The space above the sheet: shows the film; tapping it puts the keyboard away. */}
        <Pressable accessible={false} onPress={dismiss} style={[styles.space, { height: spaceH }]} />

        <View style={[styles.sheet, { width: colW, paddingBottom: insets.bottom + 14 }, wide && styles.sheetWide]}>
          <View onLayout={(e) => setContentH(Math.ceil(e.nativeEvent.layout.height))}>
            {/* keyed by step, so each new step eases in */}
            <Rise key={success ? 'success' : step} distance={success ? 0 : 12}>
              {success ? (
                <View style={{ minHeight: success.height, justifyContent: 'center' }}>
                  <SheetSuccess title={success.title} message={success.message} />
                </View>
              ) : step === 'phone' ? (
                <PhoneStep
                  onCode={(c) => {
                    holdKeyboard();
                    setChallenge(c);
                  }}
                  onSocial={(s, label) => signIn(s, label)}
                />
              ) : step === 'otp' && challenge ? (
                <OtpStep
                  challenge={challenge}
                  onChangeNumber={() => setChallenge(null)}
                  onVerified={(s) => celebrate('Verified', '', () => signIn(s, challenge.displayPhone))}
                />
              ) : step === 'details' && session ? (
                <DetailsStep
                  token={session.token}
                  initial={session.profile}
                  autoFocus={keyboardShown}
                  onSaved={async (profile) => {
                    holdKeyboard();
                    await completeProfile(profile);
                    setEditingDetails(false);
                  }}
                  onNotYou={() => {
                    setChallenge(null);
                    signOut();
                  }}
                />
              ) : step === 'staff' && session ? (
                <PincodeStep
                  key={`staff-${pinReset}`}
                  autoFocus={(keyboardShown || pinReset > 0) && !pickedPin}
                  autoCheck={!!pickedPin}
                  token={session.token}
                  initial={pickedPin ?? undefined}
                  title="Your work location"
                  subtitle="Enter your location’s PIN code to start."
                  helper="Demo staff · LPU 144411 · NIT Jalandhar 144011 · Model Town 144003"
                  backLabel="Not staff? Use another number"
                  onServed={async (pin, loc) => {
                    const staff = await staffSignIn(session.phone, pin);
                    celebrate(`Welcome, ${staff.name.split(' ')[0]}`, '', () => completeStaffSignIn(staff.id, pin), true);
                  }}
                  onUnavailable={showUnavailable}
                  onEditDetails={() => {
                    setChallenge(null);
                    signOut();
                  }}
                />
              ) : session ? (
                // a fresh step (empty field, focused) each time "Try another PIN code" is chosen
                <PincodeStep
                  key={pinReset}
                  autoFocus={(keyboardShown || pinReset > 0) && !pickedPin}
                  autoCheck={!!pickedPin}
                  token={session.token}
                  initial={pickedPin ?? (pinReset > 0 ? undefined : session.pincode)}
                  onServed={(pin, loc) => celebrate("You're all set", '', () => completePincode(pin), true)}
                  onUnavailable={showUnavailable}
                  onEditDetails={() => {
                    holdKeyboard();
                    setEditingDetails(true);
                  }}
                />
              ) : null}
            </Rise>
          </View>
        </View>
      </Animated.ScrollView>

      {Platform.OS !== 'web' ? (
        <TextInput
          ref={keeper}
          keyboardType="number-pad"
          caretHidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={styles.keeper}
        />
      ) : null}
      {step === 'phone' ? <SkipButton style={{ top: heroTop + insets.top + 12, right: colLeft + 16 }} onPress={continueAsGuest} /> : null}
      <BottomSheet visible={!!unavailable} onClose={tryAnotherPin}>
        <Image source={UNAVAILABLE_ART} style={styles.sheetArt} resizeMode="contain" accessible={false} />
        <Text style={styles.sheetTitle} accessibilityRole="header">
          We’re not at {unavailable?.pin} yet
        </Text>
        <Text style={[text.body, styles.sheetText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          Choose an open location to continue with its PIN code.
        </Text>
        <View style={styles.locList}>
          {(unavailable?.active ?? []).map((loc) => {
            const logo = getCampusLogo(loc);
            const displayName = loc.shortName === 'LPU' ? 'LPU Phagwara' : loc.name;
            const subtitle =
              loc.id === 'loc-lpu' || loc.shortName === 'LPU'
                ? 'Campus Counter · Phagwara'
                : loc.id === 'loc-nit' || loc.shortName?.includes('NIT')
                ? 'Campus Counter · Jalandhar'
                : 'Store & Home Pickup · Jalandhar';
            return (
              <Pressable
                key={loc.id}
                onPress={() => chooseLocation(loc)}
                accessibilityRole="button"
                accessibilityLabel={`${displayName}, PIN code ${loc.pincode}. Use this location`}
                style={({ pressed }) => [
                  styles.locCard,
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
                  pressed && styles.locBtnPressed,
                ]}
              >
                <View style={styles.locLogoWrap}>
                  {logo ? (
                    <Image source={logo} style={styles.locLogo} resizeMode="contain" />
                  ) : (
                    <Icon name="store" size={24} color={colors.navy} />
                  )}
                </View>
                <View style={styles.locInfo}>
                  <Text style={styles.locName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.locSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </View>
                <View style={styles.locRight}>
                  <View style={styles.locPinBadge}>
                    <Text style={styles.locPinText} numberOfLines={1}>
                      {loc.pincode}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={16} color="#94A3B8" />
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button label="Try another PIN code" variant="dark" onPress={tryAnotherPin} style={{ marginTop: 20 }} />
      </BottomSheet>
    </View>
  );
}

/** Frosted-glass pill over the film: browse without signing in. */
function SkipButton({ style, onPress }: { style: object; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip sign in for now"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.skip, style, pressed && styles.skipPressed]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.skipTint} />
      <Text style={styles.skipText}>Skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  /** Off-screen and invisible; only ever holds focus between two steps. */
  keeper: { position: 'absolute', left: -1000, top: 0, width: 1, height: 1, opacity: 0 },
  flex: { flex: 1 },
  hero: { position: 'absolute', overflow: 'hidden' },
  dim: { backgroundColor: '#0B1220' },
  content: { alignItems: 'center' },
  space: { alignSelf: 'stretch' },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: SHEET_PAD_TOP,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -10px 30px rgba(11, 18, 32, 0.10)' } as any)
      : {
          shadowColor: '#0B1220',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.1,
          shadowRadius: 18,
          elevation: 16,
        }),
  },
  sheetWide: { paddingHorizontal: 28 },
  sheetArt: { alignSelf: 'center', width: 140, height: 140 / UNAVAILABLE_ASPECT, marginBottom: 8 },
  sheetTitle: { textAlign: 'center', fontSize: 20, lineHeight: 24, fontFamily: fonts.bold, color: colors.ink },
  sheetText: { textAlign: 'center', alignSelf: 'center', width: '100%', maxWidth: 420, marginTop: 4, paddingHorizontal: 8, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  locList: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 28, 62, 0.08)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(11, 18, 32, 0.04)',
          transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
        } as any)
      : {
          shadowColor: '#0B1220',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        }),
  },
  locLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAF9F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.08)',
  },
  locLogo: {
    width: 40,
    height: 40,
  },
  locInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
    justifyContent: 'center',
  },
  locName: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    lineHeight: 19,
    color: colors.ink,
  },
  locSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
    marginTop: 2,
  },
  locRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  locPinBadge: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0A1C3E',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  locPinText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  locBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
    backgroundColor: '#EBEFF5',
  },
  skip: {
    position: 'absolute',
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  skipTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  skipPressed: { opacity: 0.75 },
  skipText: { fontFamily: fonts.regular, fontSize: 13, letterSpacing: 0.2, color: '#FFFFFF' },
});
