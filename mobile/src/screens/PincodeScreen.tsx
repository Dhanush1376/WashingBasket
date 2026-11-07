import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { VerificationSuccess } from '../components/auth/VerificationSuccess';
import { OnboardingScaffold } from '../components/onboarding/OnboardingScaffold';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Check } from '../components/ui/icons';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { TextField } from '../components/ui/TextField';
import { useShake } from '../hooks/useShake';
import { haptic } from '../lib/haptics';
import type { ScreenProps } from '../navigation/types';
import { profileService } from '../services/profile';
import { isValidPincode, serviceabilityService } from '../services/serviceability';
import { useSession } from '../session/session';
import { colors, fonts, type } from '../theme';

const ART = { source: require('../../assets/illustrations/pincode-ironing.png'), aspect: 721 / 586, formHeight: 330 };

const UNAVAILABLE_ART = require('../../assets/illustrations/unavailable-map-pin.png');
const UNAVAILABLE_ASPECT = 839 / 641;

type Status = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'failed';
const CONFIRM_HOLD_MS = 2100;

export function PincodeScreen({ navigation }: ScreenProps<'Pincode'>) {
  const { session, completePincode } = useSession();
  const [pin, setPin] = useState(session?.pincode ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const inputRef = useRef<TextInputInstance>(null);
  const { shake, style: shakeStyle } = useShake();

  const check = async (value = pin) => {
    if (busy.current || done || !session) return;
    if (!isValidPincode(value)) {
      setStatus('invalid');
      shake();
      return;
    }
    busy.current = true;
    setStatus('checking');
    try {
      const { serviceable } = await serviceabilityService.check(value);
      if (!serviceable) {
        inputRef.current?.blur();
        setStatus('unavailable'); // opens the drawer
        haptic.error();
        busy.current = false;
        return;
      }
      setStatus('available');
      await profileService.savePincode(session.token, value);
      haptic.success();
      setDone(true);
      setTimeout(() => completePincode(value), CONFIRM_HOLD_MS);
    } catch {
      setStatus('failed');
      busy.current = false;
    }
  };

  const tryAnother = () => {
    setStatus('idle');
    setPin('');
    setTimeout(() => inputRef.current?.focus(), 350);
  };

  const message =
    status === 'invalid'
      ? 'Enter a valid 6-digit PIN code.'
      : status === 'failed'
        ? "We couldn't check right now. Please try again."
        : null;

  return (
    <>
      <OnboardingScaffold
        step={3}
        art={ART}
        onBack={() => (navigation.getState().index > 0 ? navigation.goBack() : navigation.navigate('Details'))}
        title="Enter your PIN code"
        subtitle="Check if Washing Basket is available in your area."
        overlay={
          done ? <VerificationSuccess title="We serve your area" message={`Pickups are available at ${pin}.`} /> : null
        }
      >
        <Animated.View style={shakeStyle}>
          <TextField
            ref={inputRef}
            label="PIN code"
            value={pin}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, 6);
              setPin(v);
              if (status !== 'checking') setStatus('idle');
              if (v.length === 6) check(v);
            }}
            keyboardType="number-pad"
            autoComplete="postal-code"
            textContentType="postalCode"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={() => check()}
            editable={status !== 'checking' && !done}
            error={message}
            autoFocus
            // digits are spaced for reading; the placeholder stays normal
            inputStyle={pin ? styles.pinInput : null}
            trailing={
              status === 'checking' ? (
                <ActivityIndicator color={colors.navy} accessibilityLabel="Checking availability" />
              ) : status === 'available' ? (
                <Animated.View entering={ZoomIn.duration(220)} style={styles.okBadge}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </Animated.View>
              ) : null
            }
          />
        </Animated.View>

        <View style={styles.cta}>
          <PrimaryButton
            label="Continue"
            onPress={() => check()}
            loading={status === 'checking'}
            success={status === 'available'}
            successLabel="Available"
            disabled={pin.length < 6}
          />
        </View>
      </OnboardingScaffold>

      <BottomSheet visible={status === 'unavailable'} onClose={tryAnother}>
        <Image
          source={UNAVAILABLE_ART}
          style={styles.sheetArt}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Our service is not available here
        </Text>
        <Text style={styles.sheetText}>
          We don't pick up at {pin} yet. Sorry for the inconvenience — we're expanding to new areas soon.
        </Text>
        <View style={styles.sheetCta}>
          <PrimaryButton label="Try another PIN code" onPress={tryAnother} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pinInput: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: 4, fontVariant: ['tabular-nums'] },
  okBadge: {
    width: 24,
    height: 24,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { marginTop: 20 },
  sheetArt: { alignSelf: 'center', width: 220, height: 220 / UNAVAILABLE_ASPECT, marginBottom: 18 },
  sheetTitle: { ...type.title, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  sheetText: {
    ...type.subtitle,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 360,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  sheetCta: { marginTop: 24 },
});
