import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardEvent, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
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
import { STAFF_ROLE_LABEL } from '../laundry/labels';
import { getCampusLogo } from '../laundry/campusLogos';
import { signIn as staffSignIn } from '../mock/services/staffService';
import type { Location } from '../mock/types';
import { useSession } from '../session/session';
import { app, colors, fonts, radius, space, text } from '../theme';

const UNAVAILABLE_ART = require('../../assets/illustrations/unavailable-map-pin.png');
const UNAVAILABLE_ASPECT = 839 / 641;
/** How long the green "done" moment holds before the next step takes over. */
const SUCCESS_HOLD_MS = 1600;

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

  // The sheet takes the height its content needs at the bottom and the film fills the space
  // above it (the film's own shape at most). On short screens the film gives way, never the form.
  const filmH = Math.round((colW * 1612) / 1200);
  const [contentH, setContentH] = useState(0);
  const sheetH = (contentH || 400) + SHEET_PAD_TOP + HANDLE_BLOCK + insets.bottom + 14;
  const spaceH = Math.round(
    Math.max(MIN_HERO - SHEET_OVERLAP, Math.min(filmH - SHEET_OVERLAP, winH - heroTop - sheetH + SHEET_OVERLAP)),
  );

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

  const tryAnotherPin = () => {
    setUnavailable(null);
    setPickedPin(null);
    setPinReset((n) => n + 1);
  };
  const chooseLocation = (loc: Location) => {
    haptic.tap();
    setUnavailable(null);
    setPickedPin(loc.pincode);
    setPinReset((n) => n + 1);
  };

  // the green moment holds, then the next step (or the app) takes over
  const celebrate = (title: string, message: string, then: () => Promise<void> | void) => {
    setSuccess({ title, message, height: contentH });
    setTimeout(async () => {
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
  const raise = useCallback(
    (to: number, duration = LIFT_MS) => {
      if (Platform.OS === 'web') return;
      const target = Math.min(to, maxLift);
      lift.set(reducedMotion ? target : withTiming(target, { duration, easing: EASE }));
    },
    [lift, maxLift, reducedMotion],
  );

  // On phones the real keyboard drives the lift, in step with its own animation.
  const keyboardUp = useRef(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e: KeyboardEvent) => {
      keyboardUp.current = true;
      raise(e.endCoordinates.height, Math.max(e.duration || 0, LIFT_MS));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e: KeyboardEvent) => {
      keyboardUp.current = false;
      raise(0, Math.max(e.duration || 0, LIFT_MS - 80));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [raise]);

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
        keyboardShouldPersistTaps="handled"
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
                <PhoneStep onCode={setChallenge} onSocial={(s, label) => signIn(s, label)} />
              ) : step === 'otp' && challenge ? (
                <OtpStep
                  challenge={challenge}
                  onChangeNumber={() => setChallenge(null)}
                  onVerified={(s) => celebrate('Number verified', "Let's finish setting up your account.", () => signIn(s, challenge.displayPhone))}
                />
              ) : step === 'details' && session ? (
                <DetailsStep
                  token={session.token}
                  initial={session.profile}
                  onSaved={async (profile) => {
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
                  autoFocus={pinReset > 0 && !pickedPin}
                  autoCheck={!!pickedPin}
                  token={session.token}
                  initial={pickedPin ?? undefined}
                  title="Your work location"
                  subtitle="Enter your location’s PIN code to start."
                  helper="Demo staff · LPU 654321 · NIT Jalandhar 123456 · Outside 000000"
                  backLabel="Not staff? Use another number"
                  onServed={async (pin, loc) => {
                    const staff = await staffSignIn(session.phone, pin);
                    celebrate(`Welcome, ${staff.name.split(' ')[0]}`, `${loc.shortName} · ${STAFF_ROLE_LABEL[staff.role]}`, () => completeStaffSignIn(staff.id, pin));
                  }}
                  onUnavailable={(pin, active) => setUnavailable({ pin, active })}
                  onEditDetails={() => {
                    setChallenge(null);
                    signOut();
                  }}
                />
              ) : session ? (
                // a fresh step (empty field, focused) each time "Try another PIN code" is chosen
                <PincodeStep
                  key={pinReset}
                  autoFocus={pinReset > 0 && !pickedPin}
                  autoCheck={!!pickedPin}
                  token={session.token}
                  initial={pickedPin ?? (pinReset > 0 ? undefined : session.pincode)}
                  onServed={(pin, loc) => celebrate('We serve your area', `Your Washing Basket location is ${loc.shortName}.`, () => completePincode(pin))}
                  onUnavailable={(pin, active) => setUnavailable({ pin, active })}
                  onEditDetails={() => setEditingDetails(true)}
                />
              ) : null}
            </Rise>
          </View>
        </View>
      </Animated.ScrollView>

      {step === 'phone' ? <SkipButton style={{ top: heroTop + insets.top + 12, right: colLeft + 16 }} onPress={continueAsGuest} /> : null}
      <BottomSheet visible={!!unavailable} onClose={tryAnotherPin}>
        <Image source={UNAVAILABLE_ART} style={styles.sheetArt} resizeMode="contain" accessible={false} />
        <Text style={[text.h1, { textAlign: 'center' }]} accessibilityRole="header">
          We’re not at {unavailable?.pin} yet
        </Text>
        <Text style={[text.body, styles.sheetText]}>Washing Basket is open at these locations. Choose one to continue with its PIN code.</Text>
        <View style={styles.locList}>
          {unavailable?.active.map((loc) => {
            const logo = getCampusLogo(loc);
            return (
              <Pressable
                key={loc.id}
                onPress={() => chooseLocation(loc)}
                accessibilityRole="button"
                accessibilityLabel={`${loc.name}, PIN code ${loc.pincode}. Use this location`}
                style={({ pressed }) => [styles.locRow, Platform.OS === 'web' && ({ cursor: 'pointer' } as object), pressed && { opacity: 0.8 }]}
              >
                <View style={styles.locIcon}>
                  {logo ? (
                    <Image source={logo} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  ) : (
                    <Icon name="mapPin" size={18} color={colors.navy} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={text.bodyStrong}>{loc.name}</Text>
                  <Text style={text.caption} numberOfLines={1}>
                    {loc.city} · {loc.serviceModes.includes('HOME_PICKUP') ? 'Drop-off & home pickup' : 'Office drop-off'}
                  </Text>
                </View>
                <View style={styles.locPin}>
                  <Text style={styles.locPinText}>{loc.pincode}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Button label="Try another PIN code" variant="outline" onPress={tryAnotherPin} style={{ marginTop: space.lg }} />
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
  sheetArt: { alignSelf: 'center', width: 220, height: 220 / UNAVAILABLE_ASPECT, marginBottom: 18 },
  sheetText: { textAlign: 'center', alignSelf: 'center', maxWidth: 360, marginTop: 8, paddingHorizontal: 8 },
  locList: { marginTop: space.lg, gap: space.sm },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: app.cream },
  locIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  locPin: { paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  locPinText: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1.5, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
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
