import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/app/AppScreen';
import { Button, Card, Pill } from '../../components/app/primitives';
import { TextField } from '../../components/ui/TextField';
import { haptic } from '../../lib/haptics';
import { invalidate, keys } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { addAddress } from '../../services/mock/account.service';
import { addProfileAddress } from '../../services/mock/profile.service';
import { isValidPincode } from '../../services/serviceability';
import { colors, space, text } from '../../theme';
import type { AddressLabel } from '../../types/models';

const LABELS: AddressLabel[] = ['Home', 'Work', 'Other'];

export function AddAddressScreen({ navigation }: ScreenProps<'AddAddress'>) {
  const [label, setLabel] = useState<AddressLabel>('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = {
    line1: line1.trim().length < 4 ? 'Add a house or flat number and street.' : null,
    line2: line2.trim().length < 2 ? 'Add an area or locality.' : null,
    city: city.trim().length < 2 ? 'Add a city.' : null,
    pincode: !isValidPincode(pincode) ? 'Enter a valid 6-digit PIN code.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = async () => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    const input = { label, line1: line1.trim(), line2: line2.trim(), city: city.trim(), pincode };
    await addAddress(input);
    await addProfileAddress(input); // the profile keeps its own list; keep it in step
    invalidate(keys.addresses, keys.dashboard, keys.profileAddresses);
    haptic.success();
    setSaving(false);
    navigation.goBack();
  };

  return (
    <AppScreen title="Add address">
      <Text style={[text.label, styles.labelTitle]}>Save as</Text>
      <View style={styles.labels}>
        {LABELS.map((l) => (
          <Pill key={l} label={l} selected={label === l} onPress={() => setLabel(l)} />
        ))}
      </View>
      <Card style={{ gap: space.md }}>
        <TextField rounded label="Flat / house no., street" value={line1} onChangeText={setLine1} autoComplete="street-address" error={touched ? errors.line1 : null} />
        <TextField rounded label="Area / locality" value={line2} onChangeText={setLine2} error={touched ? errors.line2 : null} />
        <TextField rounded label="City" value={city} onChangeText={setCity} autoComplete="postal-address-locality" error={touched ? errors.city : null} />
        <TextField
          rounded
          label="PIN code"
          value={pincode}
          onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="postal-code"
          maxLength={6}
          error={touched ? errors.pincode : null}
        />
      </Card>
      <Text style={[text.caption, styles.note]}>We'll check pickup availability for this PIN code when you book.</Text>
      <Button label="Save address" onPress={save} loading={saving} style={{ marginTop: space.xl }} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  labelTitle: { marginBottom: space.sm },
  labels: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  note: { marginTop: space.md, paddingHorizontal: 4, color: colors.inkSoft },
});
