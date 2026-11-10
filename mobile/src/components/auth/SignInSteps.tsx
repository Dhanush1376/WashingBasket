import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Country, DEFAULT_COUNTRY, formatNational, maxDigits, readNational, validateNational } from '../../data/countries';
import { useShake } from '../../hooks/useShake';
import { haptic } from '../../lib/haptics';
import { AuthError, authService, type OtpChallenge, type Session, type SocialProvider } from '../../services/auth';
import { profileService, type Profile } from '../../services/profile';
import type { Location } from '../../mock/types';
import { isValidPincode, serviceabilityService } from '../../services/serviceability';
import { brand, colors, fonts, space, text, type } from '../../theme';
import { Icon } from '../app/Icon';
import { Rise } from '../app/motion';
import { SuccessTickBadge } from './SuccessTickBadge';
import { Button } from '../app/primitives';
import { AppleIcon, GoogleIcon } from '../ui/icons';
import { formStyles, FORM, OtpCells, PillField } from '../ui/SheetForm';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_LENGTH = 6;

export type Challenge = OtpChallenge & { displayPhone: string };

/** "+91 98765 43210" → "+91 98••• ••210": enough to recognise, not enough to read off a screen. */
export function maskPhone(display: string) {
  const space_ = display.indexOf(' ');
  const dial = display.slice(0, space_);
  const national = display.slice(space_ + 1);
  const count = national.replace(/\D/g, '').length;
  let i = 0;
  const masked = national.replace(/\d/g, (d) => {
    const keep = i < 2 || i >= count - 3;
    i += 1;
    return keep ? d : '•';
  });
  return `${dial} ${masked}`.replace(/ /g, ' '); // never wraps
}

/** Title and subtitle under it for sign-in steps. */
function StepHead({ title, subtitle }: { step?: number; title: string; subtitle: React.ReactNode }) {
  return (
    <View>
      <Text style={text.h1} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

function TextLink({ label, icon, onPress }: { label: string; icon?: 'chevronLeft' | 'logout'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.link, webCursor, pressed && { opacity: 0.6 }]}>
      {icon ? <Icon name={icon} size={15} color={brand.navy} /> : null}
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** The "done" moment, inside the sheet: a green tick pops in with the title and a line under it. */
export function SheetSuccess({ title, message, size = 88 }: { title: string; message?: string; size?: number }) {
  return <SuccessTickBadge title={title} message={message || undefined} size={size} />;
}




/** Android only: a cursor pinned to the end of `text` (undefined elsewhere, where the cursor already follows). */
const ANDROID_END = (text: string) => (Platform.OS === 'android' ? { start: text.length, end: text.length } : undefined);

/* ───────────── 1. Mobile number ───────────── */

export function PhoneStep({ onCode, onSocial }: { onCode: (c: Challenge) => void; onSocial: (s: Session, label: string) => Promise<void> }) {
  const country = DEFAULT_COUNTRY;
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const { shake, style: shakeStyle } = useShake();

  const problem = validateNational(digits, country);
  // only speak up about the format once the number is complete, never mid-typing
  const shownError = error ?? (digits.length >= maxDigits(country) ? problem : null);

  const onContinue = async () => {
    if (loading) return;
    if (problem) {
      setError(problem);
      haptic.error();
      shake();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const challenge = await authService.requestOtp(country.dialCode + digits);
      onCode({ ...challenge, displayPhone: `${country.dialCode} ${formatNational(digits, country)}` });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
      haptic.error();
      shake();
      setLoading(false);
    }
  };

  const social = async (provider: SocialProvider) => {
    if (socialBusy || loading) return;
    const name = provider === 'google' ? 'Google' : 'Apple';
    setSocialBusy(provider);
    setError(null);
    try {
      const session = await authService.signInWithProvider(provider);
      haptic.success();
      await onSocial(session, `${name} account`);
    } catch {
      setError(`${name} sign-in did not complete. Please try again.`);
      haptic.error();
      setSocialBusy(null);
    }
  };

  return (
    <View>
      <StepHead title="Welcome to Washing Basket" subtitle="Enter your mobile number to continue." />

      <Rise delay={80} style={styles.phoneWrap}>
        <Animated.View style={shakeStyle}>
          <PillField
            ref={inputRef}
            value={formatNational(digits, country)}
            onChangeText={(t) => {
              setDigits((d) => readNational(t, d, country));
              if (error) setError(null);
            }}
            onSubmitEditing={onContinue}
            placeholder="Mobile number"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            busy={loading}
            invalid={!!shownError}
            inputStyle={styles.phoneInput}
            leading={
              <View style={styles.country}>
                <Text style={styles.countryText}>+91</Text>
              </View>
            }
            icon="phone"
          />
        </Animated.View>
        <Text style={[formStyles.helper, shownError && { color: colors.danger }]}>{shownError ?? "We'll text you a 6-digit code to confirm it's you."}</Text>
      </Rise>

      <Rise delay={140} style={{ marginTop: space.lg }}>
        <Button label="Continue" variant="dark" onPress={onContinue} loading={loading} disabled={!digits} />
      </Rise>

      <Rise delay={190}>
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>
        <View style={styles.socialRow}>
          <SocialPill label="Google" icon={<GoogleIcon size={17} />} busy={socialBusy === 'google'} disabled={!!socialBusy || loading} onPress={() => social('google')} />
          <SocialPill label="Apple" icon={<AppleIcon size={17} color="#000000" />} busy={socialBusy === 'apple'} disabled={!!socialBusy || loading} onPress={() => social('apple')} />
        </View>
        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink} accessibilityRole="link">
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.legalLink} accessibilityRole="link">
            Privacy Policy
          </Text>
          .
        </Text>
      </Rise>
    </View>
  );
}

function SocialPill({ label, icon, busy, disabled, onPress }: { label: string; icon: React.ReactNode; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [styles.social, webCursor, pressed && { transform: [{ scale: 0.97 }] }, disabled && !busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={colors.ink} /> : icon}
      <Text style={styles.socialText}>{label}</Text>
    </Pressable>
  );
}

/* ───────────── 2. The code ───────────── */

export function OtpStep({ challenge, onChangeNumber, onVerified }: { challenge: Challenge; onChangeNumber: () => void; onVerified: (s: Session) => void }) {
  const [requestId, setRequestId] = useState(challenge.requestId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(challenge.resendAfter);
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
    // straight away: the keyboard is usually still up from the number step, so it never drops
    const t = setTimeout(() => inputRef.current?.focus(), 30);
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
      haptic.success();
      // no blur: the sign-in screen keeps the keyboard up through the tick and the next step
      onVerified(session);
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
      const next = await authService.requestOtp(challenge.phone);
      setRequestId(next.requestId);
      setResendIn(next.resendAfter);
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
    <View>
      <StepHead
        title="Verify your number"
        subtitle={
          <>
            Enter the 6-digit code sent to <Text style={styles.strong}>{maskPhone(challenge.displayPhone)}</Text>
          </>
        }
      />

      <Rise delay={80} style={{ marginTop: space.lg }}>
        <Animated.View style={shakeStyle}>
          <OtpCells
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
        <View style={[formStyles.summary, styles.resend]} accessibilityLiveRegion="polite">
          {error ? (
            <Text style={[styles.resendText, { color: colors.danger }]}>{error}</Text>
          ) : resentNote ? (
            <Text style={[styles.resendText, { color: colors.success }]}>A new code is on its way.</Text>
          ) : resendIn > 0 ? (
            <Text style={styles.resendText}>
              Didn&apos;t get it? Resend in <Text style={styles.strong}>{mm}:{ss}</Text>
            </Text>
          ) : (
            <Text style={styles.resendText}>
              Didn&apos;t get it?{' '}
              <Text style={styles.inlineLink} onPress={resending ? undefined : resend} accessibilityRole="button">
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </Text>
          )}
        </View>
      </Rise>

      <Rise delay={140} style={{ marginTop: space.lg }}>
        <Button label="Verify" variant="dark" onPress={() => verify()} loading={verifying} disabled={code.length < CODE_LENGTH || verified} />
      </Rise>
      {!verified ? (
        <Rise delay={180}>
          <TextLink icon="chevronLeft" label="Change number" onPress={onChangeNumber} />
        </Rise>
      ) : null}
    </View>
  );
}

/* ───────────── 3. Name and email ───────────── */

export function DetailsStep({
  token,
  initial,
  onSaved,
  onNotYou,
  autoFocus,
}: {
  token: string;
  initial?: Profile;
  /** Focus the name field straight away (the keyboard is already up from the previous step). */
  autoFocus?: boolean;
  onSaved: (p: Profile) => Promise<void>;
  onNotYou: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const nErr = !fullName.trim() ? 'Please enter your name.' : fullName.trim().length < 2 ? 'That looks a little short.' : null;
  const eErr = !email.trim() ? 'Please enter your email.' : EMAIL.test(email.trim()) ? null : 'Enter a valid email, like name@example.com.';
  const shown = failure ?? (touched ? nErr ?? eErr : null);

  const submit = async () => {
    setTouched(true);
    if (nErr || eErr || saving) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await profileService.saveProfile(token, { fullName: fullName.trim().replace(/\s+/g, ' '), email: email.trim() });
      haptic.success();
      await onSaved(saved);
    } catch {
      setFailure("We couldn't save your details. Check your connection and try again.");
      haptic.error();
      setSaving(false);
    }
  };

  return (
    <View>
      <StepHead title="Your details" subtitle="We'll use these for order updates." />
      <Rise delay={80} style={{ marginTop: space.lg }}>
        <PillField
          icon="user"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          autoFocus={autoFocus}
          invalid={touched && !!nErr}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={60}
          busy={saving}
        />
      </Rise>
      <Rise delay={130} style={{ marginTop: space.md }}>
        <PillField
          ref={emailRef}
          icon="mail"
          value={email}
          // an email never has spaces; Android keyboards add one after a suggestion or a pasted address
          onChangeText={(t) => setEmail(t.replace(/\s/g, ''))}
          spellCheck={false}
          placeholder="Email address"
          invalid={touched && !!eErr}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={120}
          busy={saving}
        />
        <Text style={[formStyles.helper, shown && { color: colors.danger }]}>{shown ?? 'Receipts and order updates are sent here.'}</Text>
      </Rise>
      <Rise delay={180} style={{ marginTop: space.lg }}>
        <Button label="Continue" variant="dark" onPress={submit} loading={saving} disabled={!fullName.trim() || !email.trim()} />
      </Rise>
      <Rise delay={220}>
        <TextLink icon="logout" label="Not you? Use another number" onPress={onNotYou} />
      </Rise>
    </View>
  );
}

/* ───────────── 4. PIN code ───────────── */

type PinStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'failed';

export function PincodeStep({
  token,
  initial,
  onServed,
  onUnavailable,
  onEditDetails,
  autoFocus,
  autoCheck,
  title = 'Your PIN code',
  subtitle = 'Check that Washing Basket serves your area.',
  helper = 'We use this to show your nearest Washing Basket location.',
  backLabel = 'Edit your details',
}: {
  token: string;
  initial?: string;
  /** Called with the matched location. May reject with an Error whose message is shown under the field. */
  onServed: (pin: string, location: Location) => void | Promise<void>;
  onUnavailable: (pin: string, active: Location[]) => void;
  onEditDetails: () => void;
  /** Focus the field straight away, e.g. after "Try another PIN code". */
  autoFocus?: boolean;
  /** Check `initial` as soon as the step opens (a location picked from the list). */
  autoCheck?: boolean;
  title?: string;
  subtitle?: string;
  helper?: string;
  backLabel?: string;
}) {
  const [pin, setPin] = useState(initial ?? '');
  const [status, setStatus] = useState<PinStatus>('idle');
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const inputRef = useRef<TextInputInstance>(null);
  const { shake, style: shakeStyle } = useShake();

  const check = async (value = pin) => {
    if (busy.current || status === 'available') return;
    setFailMessage(null);
    if (!isValidPincode(value)) {
      setStatus('invalid');
      shake();
      return;
    }
    busy.current = true;
    setStatus('checking');
    try {
      const { serviceable, location, activeLocations } = await serviceabilityService.check(value);
      if (!serviceable || !location) {
        inputRef.current?.blur();
        setStatus('unavailable');
        haptic.error();
        busy.current = false;
        onUnavailable(value, activeLocations);
        return;
      }
      await profileService.savePincode(token, value);
      await onServed(value, location);
      setStatus('available');
      haptic.success();
    } catch (e) {
      setFailMessage(e instanceof Error && e.message ? e.message : null);
      setStatus('failed');
      haptic.error();
      busy.current = false;
    }
  };

  // a location picked from the "active locations" list is checked straight away
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoCheck && initial && !autoChecked.current) {
      autoChecked.current = true;
      check(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheck, initial]);

  const message =
    status === 'invalid' ? 'Enter a valid 6-digit PIN code.' : status === 'failed' ? (failMessage ?? "We couldn't check right now. Please try again.") : null;

  return (
    <View>
      <StepHead title={title} subtitle={subtitle} />
      <Rise delay={80} style={{ marginTop: space.lg }}>
        <Animated.View style={shakeStyle}>
          <PillField
            ref={inputRef}
            value={pin}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 6);
              setPin(v);
              if (status !== 'checking') setStatus('idle');
              if (v.length === 6) check(v);
            }}
            placeholder="6-digit PIN code"
            autoFocus={autoFocus}
            keyboardType="number-pad"
            autoComplete="postal-code"
            textContentType="postalCode"
            maxLength={6}
            // while the "not here yet" drawer is up the field can't take focus back (iOS would otherwise
            // raise the keyboard over a drawer that has nothing to type into)
            editable={status !== 'unavailable'}
            onSubmitEditing={() => check()}
            busy={status === 'checking' || status === 'available'}
            invalid={!!message}
            inputStyle={pin ? styles.pinInput : null}
            trailing={
              status === 'checking' ? (
                <>
                  <View style={formStyles.divider} />
                  <ActivityIndicator color={colors.ink} accessibilityLabel="Checking availability" />
                </>
              ) : status === 'available' ? (
                <>
                  <View style={formStyles.divider} />
                  <View style={styles.okBadge}>
                    <Icon name="check" size={18} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </>
              ) : undefined
            }
            icon="mapPin"
          />
        </Animated.View>
        <Text style={[formStyles.helper, message && { color: colors.danger }]}>{message ?? helper}</Text>
      </Rise>
      <Rise delay={130} style={{ marginTop: space.lg }}>
        <Button
          label={status === 'available' ? 'Available' : 'Check availability'}
          variant="dark"
          onPress={() => check()}
          loading={status === 'checking'}
          disabled={pin.length < 6 || status === 'available'}
        />
      </Rise>
      <Rise delay={170}>
        <TextLink icon="chevronLeft" label={backLabel} onPress={onEditDetails} />
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  success: { alignItems: 'center', paddingVertical: space.xl },
  successRing: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.successTint, alignItems: 'center', justifyContent: 'center' },
  successBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  successTitle: { textAlign: 'center', marginTop: space.lg },
  successText: { textAlign: 'center', marginTop: 4 },
  strong: { fontFamily: fonts.semibold, color: colors.ink },

  phoneWrap: { marginTop: space.lg, position: 'relative', zIndex: 1 },
  phoneWrapOpen: { zIndex: 9999, elevation: 9999 },
  phoneInput: { letterSpacing: 0.4, fontVariant: ['tabular-nums'], backgroundColor: 'transparent' },
  country: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%', paddingLeft: 4, paddingRight: 2 },
  countryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: space.md },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  orText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  socialRow: { flexDirection: 'row', gap: space.sm },
  social: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.25,
    borderColor: FORM.edge,
    backgroundColor: FORM.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, letterSpacing: 0.1 },
  legal: { ...type.legal, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: space.md },
  legalLink: { fontFamily: fonts.medium, color: colors.ink, textDecorationLine: 'underline' },

  resend: { justifyContent: 'center', minHeight: 46 },
  resendText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  inlineLink: { fontFamily: fonts.semibold, color: brand.navy },

  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md, marginTop: space.xs },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: brand.navy },

  pinInput: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: 4, fontVariant: ['tabular-nums'] },
  okBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
