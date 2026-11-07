import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/app/AppScreen';
import { Button, Card } from '../../components/app/primitives';
import { TextField } from '../../components/ui/TextField';
import { useAppUser } from '../../hooks/useAppUser';
import { haptic } from '../../lib/haptics';
import { invalidate, keys } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { updateUser } from '../../services/mock/account.service';
import { updateCustomerProfile } from '../../services/mock/profile.service';
import { useSession } from '../../session/session';
import { colors, space, text } from '../../theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const me = useAppUser();
  const { completeProfile } = useSession();
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const nameErr = name.trim().length < 2 ? 'Please enter your full name.' : null;
  const emailErr = !EMAIL.test(email.trim()) ? 'Enter a valid email, like name@example.com.' : null;
  const changed = name.trim() !== me.name || email.trim() !== me.email;

  const save = async () => {
    setTouched(true);
    if (nameErr || emailErr || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const fullName = name.trim();
      const mail = email.trim();
      // the mock profile and the signed-in session both carry the name shown across the app
      await updateUser({ name: fullName, email: mail });
      await updateCustomerProfile({ fullName, email: mail }); // the profile page reads its own data
      await completeProfile({ fullName, email: mail });
      invalidate(keys.user, keys.profile);
      haptic.success();
      navigation.goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen title="Edit profile">
      <Card style={{ gap: space.md }}>
        <TextField rounded label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" maxLength={60} error={touched ? nameErr : null} />
        <TextField
          rounded
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={120}
          error={touched ? emailErr : null}
        />
        <View style={styles.phone}>
          <Text style={text.caption}>Mobile number</Text>
          <Text style={text.bodyStrong}>{me.phone}</Text>
          <Text style={text.caption}>Your number is how you sign in, so it can't be changed here.</Text>
        </View>
      </Card>
      {failed ? <Text style={styles.error}>We couldn't save your changes. Please try again.</Text> : null}
      <Button label="Save changes" onPress={save} loading={saving} disabled={!changed} style={{ marginTop: space.xl }} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  phone: { gap: 2, paddingHorizontal: 4, paddingTop: space.sm },
  error: { ...text.caption, color: colors.danger, marginTop: space.md },
});
