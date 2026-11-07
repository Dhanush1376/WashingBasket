import React, { useRef, useState } from 'react';
import { StyleSheet, TextInputInstance, View } from 'react-native';

import { OnboardingScaffold } from '../components/onboarding/OnboardingScaffold';
import { InlineError } from '../components/ui/InlineError';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { TextField } from '../components/ui/TextField';
import { haptic } from '../lib/haptics';
import type { ScreenProps } from '../navigation/types';
import { profileService } from '../services/profile';
import { useSession } from '../session/session';

const ART = {
  source: require('../../assets/illustrations/details-drying.png'),
  aspect: 760 / 660,
  formHeight: 360,
  // the clothesline runs on to the edge of the screen
  // (measured on the artwork: the line leaves the image at y 220, rising 0.09 px per px, 3 px thick)
  extendLine: { x: 758, y: 220, slope: -0.09, width: 3, color: '#A2B2CD', imageWidth: 760 },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function nameError(v: string) {
  const t = v.trim();
  if (!t) return 'Please enter your name.';
  if (t.length < 2) return 'That looks a little short.';
  return null;
}

function emailError(v: string) {
  const t = v.trim();
  if (!t) return 'Please enter your email.';
  return EMAIL.test(t) ? null : 'Enter a valid email, like name@example.com.';
}

export function DetailsScreen({ navigation }: ScreenProps<'Details'>) {
  const { session, completeProfile } = useSession();
  const [fullName, setFullName] = useState(session?.profile?.fullName ?? '');
  const [email, setEmail] = useState(session?.profile?.email ?? '');
  const [touched, setTouched] = useState({ name: false, email: false });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const nErr = nameError(fullName);
  const eErr = emailError(email);

  const submit = async () => {
    setTouched({ name: true, email: true });
    if (nErr || eErr || saving || !session) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved = await profileService.saveProfile(session.token, { fullName, email });
      await completeProfile(saved);
      navigation.navigate('Pincode');
    } catch {
      setFailure("We couldn't save your details. Check your connection and try again.");
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScaffold
      step={2}
      art={ART}
      // first onboarding step: Back only when the user came here from the PIN code step
      onBack={navigation.getState().index > 0 ? () => navigation.goBack() : undefined}
      title="Enter your details"
      subtitle="We'll use this to keep you updated on your orders."
    >
      <View style={styles.fields}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={touched.name ? nErr : null}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          submitBehavior="submit"
          maxLength={60}
          editable={!saving}
          autoFocus
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={touched.email ? eErr : null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={120}
          editable={!saving}
        />
      </View>

      {failure ? <InlineError message={failure} /> : null}

      <View style={styles.cta}>
        <PrimaryButton label="Continue" onPress={submit} loading={saving} disabled={!!nErr || !!eErr} />
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  cta: { marginTop: 20 },
});
