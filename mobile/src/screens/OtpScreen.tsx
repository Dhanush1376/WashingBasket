import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInputInstance, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OtpInput } from '../components/auth/OtpInput';
import { VerificationSuccess } from '../components/auth/VerificationSuccess';
import { OnboardingScaffold } from '../components/onboarding/OnboardingScaffold';
import { InlineError } from '../components/ui/InlineError';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { useShake } from '../hooks/useShake';
import { haptic } from '../lib/haptics';
import type { ScreenProps } from '../navigation/types';
import { AUTH_IS_DEMO, AuthError, authService, DEMO_OTP } from '../services/auth';
import { useSession } from '../session/session';
import { colors, fonts, radius, type } from '../theme';

const CODE_LENGTH = 6;
const ART = { source: require('../../assets/illustrations/otp-washing.png'), aspect: 816 / 622 };
const SUCCESS_HOLD_MS = 2100;

/** "+91 98765 43210" → "+91 98••• ••210": enough to recognise, not enough to read off a screen. */
export function maskPhone(display: string) {
  const space = display.indexOf(' ');
  const dial = display.slice(0, space);
  const national = display.slice(space + 1);
  const count = national.replace(/\D/g, '').length;
  let i = 0;
  const masked = national.replace(/\d/g, (d) => {
    const keep = i < 2 || i >= count - 3;
    i += 1;
    return keep ? d : '•';
  });
  // non-breaking spaces: the number never wraps across lines
  return `${dial} ${masked}`.replace(/ /g, ' ');
}

export function OtpScreen({ navigation, route }: ScreenProps<'Otp'>) {
  const { phone, displayPhone } = route.params;
  const { signIn } = useSession();

  const [requestId, setRequestId] = useState(route.params.requestId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(route.params.resendAfter);
  const [resending, setResending] = useState(false);
  const [resentNote, setResentNote] = useState(false);
  const busy = useRef(false);
  const inputRef = useRef<TextInputInstance>(null);
  const { shake, style: shakeStyle } = useShake();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 450);
    return () => clearTimeout(t);
  }, []);

  const verify = async (value = code) => {
    // one request at a time: auto-submit and a tap on Verify can't race each other
    if (value.length < CODE_LENGTH || busy.current || verified) return;
    busy.current = true;
    setVerifying(true);
    setError(null);
    try {
      const session = await authService.verifyOtp(requestId, value);
      setVerified(true);
      inputRef.current?.blur();
      haptic.success();
      // the confirmation holds briefly, then the session moves the app on to the next step
      setTimeout(() => signIn(session, displayPhone), SUCCESS_HOLD_MS);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
      haptic.error();
      shake();
      setCode('');
      busy.current = false;
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    try {
      const challenge = await authService.requestOtp(phone);
      setRequestId(challenge.requestId);
      setResendIn(challenge.resendAfter);
      setCode('');
      setResentNote(true);
      setTimeout(() => setResentNote(false), 2500);
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  const mm = Math.floor(resendIn / 60);
  const ss = String(resendIn % 60).padStart(2, '0');

  return (
    <OnboardingScaffold
      step={1}
      art={ART}
      onBack={verified ? undefined : () => navigation.goBack()}
      title="Verify your number"
      subtitle={
        <>
          Enter the 6-digit code sent to{' '}
          <Text style={styles.phone} accessibilityLabel={`your number ending ${phone.slice(-3).split('').join(' ')}`}>
            {maskPhone(displayPhone)}
          </Text>
          {'  '}
          <Text style={styles.link} onPress={() => navigation.goBack()} accessibilityRole="link">
            Change
          </Text>
        </>
      }
      overlay={
        verified ? (
          <VerificationSuccess title="Number verified" message="Let's finish setting up your account." />
        ) : null
      }
    >
      <Animated.View style={shakeStyle}>
        <OtpInput
          ref={inputRef}
          length={CODE_LENGTH}
          value={code}
          invalid={!!error}
          disabled={verifying || verified}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
            if (v.length === CODE_LENGTH) verify(v);
          }}
        />
      </Animated.View>

      {error ? (
        <InlineError message={error} />
      ) : null}

      <View style={styles.cta}>
        <PrimaryButton
          label="Verify"
          onPress={() => verify()}
          loading={verifying}
          success={verified}
          disabled={code.length < CODE_LENGTH}
        />
      </View>

      <View style={styles.resendRow} accessibilityLiveRegion="polite">
        {resentNote ? (
          <Animated.Text entering={FadeIn} style={styles.resentNote}>
            A new code is on its way.
          </Animated.Text>
        ) : resendIn > 0 ? (
          <Text style={styles.muted}>
            Didn't get it? Resend in{' '}
            <Text style={styles.timer}>
              {mm}:{ss}
            </Text>
          </Text>
        ) : (
          <Text style={styles.muted}>
            Didn't get it?{' '}
            <Text
              style={[styles.link, resending && styles.linkBusy]}
              onPress={resending ? undefined : resend}
              accessibilityRole="button"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </Text>
          </Text>
        )}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  phone: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink, letterSpacing: 0.2 },
  link: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.navy },
  linkBusy: { color: colors.inkMuted },
  demo: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.ctaTint,
  },
  demoText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.cta },
  demoCode: { fontFamily: fonts.bold, letterSpacing: 1 },
  cta: { marginTop: 28 },
  resendRow: { alignItems: 'center', marginTop: 20, minHeight: 22 },
  muted: { ...type.subtitle, fontSize: 14 },
  timer: { fontFamily: fonts.semibold, color: colors.ink, fontVariant: ['tabular-nums'] },
  resentNote: { fontFamily: fonts.medium, fontSize: 14, color: colors.success },
});
