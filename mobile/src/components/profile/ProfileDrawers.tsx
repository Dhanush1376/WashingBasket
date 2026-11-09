import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '../app/Icon';
import { Rise } from '../app/motion';
import { Avatar, Button } from '../app/primitives';
import { OptionChip, PillField } from '../ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { isValidPincode } from '../../services/serviceability';
import { brand, colors, fonts, space, text } from '../../theme';
import type { CustomerProfile, ProfileAddress } from '../../types/profile';

export type NewAddress = { label: ProfileAddress['label']; line1: string; line2: string; city: string; pincode: string };
const LABELS: ProfileAddress['label'][] = ['Home', 'Work', 'Other'];
const LABEL_ICON: Record<ProfileAddress['label'], IconName> = { Home: 'home', Work: 'bag', Other: 'mapPin' };

/* Curated handsome, fair complexion illustrated avatars matching official Washing Basket logo colors (Yellow, Orange, Navy, Red) */
export const HANDSOME_AVATAR_OPTIONS = [
  {
    id: 'male-modern',
    label: 'Modern',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Alexander&skinColor=ffdbb4&hairColor=2c1b18&top=shortFlat&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=262e33&backgroundColor=ffa742',
  },
  {
    id: 'male-wavy',
    label: 'Wavy',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Oliver&skinColor=ffdbb4&hairColor=2c1b18&top=shortCurly&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=graphicShirt&clothingColor=013e86&backgroundColor=ffa742',
  },
  {
    id: 'male-sharp',
    label: 'Sharp',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Julian&skinColor=ffdbb4&hairColor=2c1b18&top=shortRound&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=hoodie&clothingColor=ffa742&backgroundColor=013e86',
  },
  {
    id: 'male-classic',
    label: 'Classic',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Lucas&skinColor=ffdbb4&hairColor=2c1b18&top=theCaesarAndSidePart&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=ffffff&backgroundColor=d30d24',
  },
  {
    id: 'female-emma',
    label: 'Emma',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Emma&skinColor=ffdbb4&hairColor=2c1b18&top=straight01&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=shirtScoopNeck&clothingColor=013e86&backgroundColor=ffa742',
  },
  {
    id: 'female-sophia',
    label: 'Sophia',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Sophia&skinColor=ffdbb4&hairColor=4a312c&top=bob&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=collarAndSweater&clothingColor=013e86&backgroundColor=ffa742',
  },
  {
    id: 'female-chloe',
    label: 'Chloe',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Chloe&skinColor=ffdbb4&hairColor=2c1b18&top=curvy&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=shirtCrewNeck&clothingColor=ffa742&backgroundColor=013e86',
  },
  {
    id: 'female-maya',
    label: 'Maya',
    url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Maya&skinColor=ffdbb4&hairColor=2c1b18&top=bun&eyes=default&eyebrows=default&mouth=smile&facialHairProbability=0&clothing=shirtVNeck&clothingColor=ffffff&backgroundColor=d30d24',
  },
];

/* The same parts as the wallet's Top Up drawer: pill fields, soft chips, a summary box and one dark action. */
const FIELD = '#F7F6F3';
const EDGE = '#E6E4DE';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* ───────────── Edit profile ───────────── */

export function EditProfileDrawer({
  customer,
  onSave,
}: {
  customer: CustomerProfile;
  onSave: (patch: { fullName: string; email: string; avatarUrl?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email);
  const [avatarUrl, setAvatarUrl] = useState(customer.avatarUrl || HANDSOME_AVATAR_OPTIONS[0].url);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const nameErr = name.trim().length < 2 ? 'Please enter your full name.' : null;
  const emailErr = !EMAIL.test(email.trim()) ? 'Enter a valid email, like name@example.com.' : null;
  const changed =
    name.trim() !== customer.fullName ||
    email.trim() !== customer.email ||
    avatarUrl !== (customer.avatarUrl || HANDSOME_AVATAR_OPTIONS[0].url);
  const error = touched ? nameErr ?? emailErr : null;

  const save = async () => {
    setTouched(true);
    if (nameErr || emailErr || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave({ fullName: name.trim(), email: email.trim(), avatarUrl });
      haptic.success();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={text.h1}>Edit profile</Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>Keep your name, avatar and email up to date.</Text>

      {/* ── Avatar selection ── */}
      <Rise delay={50} style={styles.avatarSection}>
        <View style={styles.avatarPreviewRow}>
          <View style={styles.previewAvatarRing}>
            <Avatar name={name || customer.fullName} url={avatarUrl} size={64} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.avatarHeading}>Choose avatar</Text>
            <Text style={styles.avatarSub} numberOfLines={1}>Male & female illustrated avatars</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.avatarScrollRow}
        >
          {HANDSOME_AVATAR_OPTIONS.map((item) => {
            const selected = avatarUrl === item.url;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  haptic.tap();
                  setAvatarUrl(item.url);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.label} avatar`}
                style={[styles.avatarItem, webCursor]}
              >
                <View style={[styles.avatarRing, selected && styles.avatarRingSelected]}>
                  <Avatar name={item.label} url={item.url} size={48} />
                  {selected && (
                    <View style={styles.avatarBadge}>
                      <Icon name="check" size={9} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.avatarChoiceText,
                    selected && styles.avatarChoiceTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Rise>

      <Rise delay={90} style={styles.fieldGap}>
        <PillField icon="user" value={name} onChangeText={setName} placeholder="Full name" invalid={touched && !!nameErr} autoCapitalize="words" maxLength={60} />
      </Rise>
      <Rise delay={150} style={styles.fieldGap}>
        <PillField
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          invalid={touched && !!emailErr}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={120}
        />
        <Text style={[styles.helper, (error || failed) && { color: colors.danger }]}>
          {failed ? "We couldn't save your changes. Please try again." : error ?? 'Your name appears on orders and receipts.'}
        </Text>
      </Rise>

      <Rise delay={210} style={styles.fieldGap}>
        <PillField locked icon="lock" value={customer.phone} placeholder="Mobile number" accessibilityLabel={`Mobile number ${customer.phone}, can't be changed`} />
        <Text style={styles.helper}>This is how you sign in, so it can&apos;t be changed here.</Text>
      </Rise>

      <Rise delay={270} style={{ marginTop: space.lg }}>
        <Button label="Save changes" variant="dark" icon="check" disabled={!changed} loading={saving} onPress={save} />
      </Rise>
    </View>
  );
}

/* ───────────── Saved addresses ───────────── */

export function AddressesDrawer({
  addresses,
  onMakeDefault,
  onAdd,
}: {
  addresses: ProfileAddress[];
  onMakeDefault: (id: string) => Promise<void>;
  onAdd: (input: NewAddress) => Promise<ProfileAddress>;
}) {
  const [adding, setAdding] = useState(addresses.length === 0);
  // the order the list opened in stays put: choosing a default never moves cards around;
  // a newly added address simply joins at the end
  const [order] = useState(() => addresses.map((x) => x.id));
  // the card you tap is the chosen one straight away; the save happens quietly behind it
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = [
    ...order.map((id) => addresses.find((x) => x.id === id)).filter((x): x is ProfileAddress => !!x),
    ...addresses.filter((x) => !order.includes(x.id)),
  ];

  const onAddNew = () => {
    haptic.tap();
    setAdding(true);
  };

  if (adding) {
    return <AddAddressForm canGoBack={addresses.length > 0} onBack={() => setAdding(false)} onSave={async (input) => {
      await onAdd(input);
      setAdding(false);
    }} />;
  }

  // tapping a card makes it the default right where it is: the selection moves, the cards don't
  const currentId = chosenId ?? items.find((x) => x.isDefault)?.id ?? null;
  const choose = async (id: string) => {
    if (busy || id === currentId) return;
    haptic.tap();
    const previous = currentId;
    setChosenId(id);
    setBusy(true);
    try {
      await onMakeDefault(id);
    } catch {
      setChosenId(previous); // only if saving failed does the choice go back
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={text.h1}>Saved addresses</Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>Tap an address to pick up and deliver there.</Text>

      <View style={styles.addrList}>
        {items.map((a, i) => (
          <Rise key={a.id} delay={80 + i * 50}>
            <AddressRow address={a} selected={a.id === currentId} onPress={() => choose(a.id)} />
          </Rise>
        ))}
      </View>

      <Rise delay={80 + items.length * 50 + 40} style={{ marginTop: space.lg }}>
        <Button label="Add a new address" variant="dark" icon="plus" onPress={onAddNew} />
      </Rise>
    </View>
  );
}

/**
 * One saved address, built like the form fields above it: a soft field that turns white with a dark edge when
 * chosen, the label icon in a white circle, the label and two lines of address, and a radio. Fixed height, and
 * choosing it is instant: no fades, no pops, nothing moves.
 */
function AddressRow({ address: a, selected, onPress }: { address: ProfileAddress; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${a.label}, ${a.line1}, ${a.line2}, ${a.city} ${a.pincode}${selected ? ', chosen' : ''}`}
      style={({ pressed }) => [
        styles.addrCard,
        selected && styles.addrCardOn,
        webCursor,
        pressed && !selected && styles.addrCardPressed,
      ]}
    >
      <View style={[styles.addrIcon, selected && styles.addrIconOn]}>
        <Icon name={LABEL_ICON[a.label]} size={18} color={selected ? '#FFFFFF' : colors.ink} strokeWidth={2.2} />
      </View>
      <View style={styles.addrBody}>
        <View style={styles.addrHeadRow}>
          <Text style={[styles.addrLabel, selected && styles.addrLabelOn]}>{a.label}</Text>
          <Text style={styles.addrPin}>• {a.pincode}</Text>
        </View>
        <Text style={styles.addrPrimaryLine} numberOfLines={1}>
          {a.line1}
        </Text>
        <Text style={styles.addrSecondaryLine} numberOfLines={1}>
          {a.line2 ? `${a.line2}, ${a.city}` : a.city}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

/** The add-address form, inside the same drawer: type chips, four pill fields, one dark action. */
function AddAddressForm({ canGoBack, onBack, onSave }: { canGoBack: boolean; onBack: () => void; onSave: (input: NewAddress) => Promise<void> }) {
  const [label, setLabel] = useState<ProfileAddress['label']>('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // the same checks as the Add address screen
  const errors = {
    line1: line1.trim().length < 4 ? 'Add a house or flat number and street.' : null,
    line2: line2.trim().length < 2 ? 'Add an area or locality.' : null,
    city: city.trim().length < 2 ? 'Add a city.' : null,
    pincode: !isValidPincode(pincode) ? 'Enter a valid 6-digit PIN code.' : null,
  };
  const firstError = Object.values(errors).find(Boolean) ?? null;
  const filled = !!(line1 || line2 || city || pincode);

  const save = async () => {
    setTouched(true);
    if (firstError || saving) return;
    setSaving(true);
    await onSave({ label, line1: line1.trim(), line2: line2.trim(), city: city.trim(), pincode });
    haptic.success();
    setSaving(false);
  };

  return (
    <View>
      <Text style={text.h1}>Add an address</Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>Where should we pick up your laundry?</Text>

      <View style={styles.chips}>
        {LABELS.map((l, i) => (
          <OptionChip
            key={l}
            label={l}
            icon={LABEL_ICON[l]}
            selected={l === label}
            delay={90 + i * 50}
            onPress={() => {
              haptic.tap();
              setLabel(l);
            }}
          />
        ))}
      </View>

      <Rise delay={240} style={styles.fieldGap}>
        <PillField icon="home" value={line1} onChangeText={setLine1} placeholder="House / flat no. and street" invalid={touched && !!errors.line1} maxLength={80} />
      </Rise>
      <Rise delay={290} style={styles.fieldGap}>
        <PillField icon="mapPin" value={line2} onChangeText={setLine2} placeholder="Area or locality" invalid={touched && !!errors.line2} maxLength={60} />
      </Rise>
      <Rise delay={340} style={[styles.pair, styles.fieldGap]}>
        <View style={{ flex: 1.2 }}>
          <PillField icon="grid" value={city} onChangeText={setCity} placeholder="City" invalid={touched && !!errors.city} autoCapitalize="words" maxLength={40} />
        </View>
        <View style={{ flex: 1 }}>
          <PillField
            icon="tag"
            value={pincode}
            onChangeText={(t) => setPincode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="PIN code"
            invalid={touched && !!errors.pincode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </Rise>
      <Rise delay={370}>
        <Text style={[styles.helper, touched && firstError && { color: colors.danger }]}>
          {touched && firstError ? firstError : 'We pick up and deliver to this address.'}
        </Text>
      </Rise>

      {canGoBack ? (
        <Rise delay={420} style={styles.actionsRow}>
          <Button label="Back" variant="outline" icon="chevronLeft" onPress={onBack} style={{ flex: 1 }} />
          <Button label="Save address" variant="dark" icon="check" disabled={!filled} loading={saving} onPress={save} style={{ flex: 1 }} />
        </Rise>
      ) : (
        <Rise delay={420} style={{ marginTop: space.lg }}>
          <Button label="Save address" variant="dark" icon="check" disabled={!filled} loading={saving} onPress={save} />
        </Rise>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { ...text.caption, color: colors.inkSoft, marginTop: space.sm, paddingHorizontal: space.sm },

  avatarSection: {
    backgroundColor: FIELD,
    borderRadius: 22,
    padding: space.md,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: EDGE,
    gap: space.md,
  },
  avatarPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  previewAvatarRing: {
    padding: 3,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E6E4DE',
  },
  avatarHeading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  avatarSub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.inkMuted,
  },
  avatarScrollRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: 2,
  },
  avatarItem: {
    alignItems: 'center',
    width: 62,
    gap: 6,
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarRingSelected: {
    borderColor: colors.orange,
    backgroundColor: '#FFFFFF',
  },
  avatarBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarChoiceText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  avatarChoiceTextSelected: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 18,
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: EDGE,
  },
  fieldGap: { marginTop: space.md },
  // a fixed height: two lines of address and one of instructions, so switching never resizes it
  addrList: { gap: space.sm, marginTop: space.lg },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: 22,
    backgroundColor: FIELD,
    borderWidth: 1.25,
    borderColor: EDGE,
  },
  addrCardOn: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.ink,
  },
  addrCardPressed: {
    backgroundColor: '#EFECE5',
  },
  addrIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: EDGE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addrIconOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  addrBody: {
    flex: 1,
    minWidth: 0,
  },
  addrHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  addrLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.ink,
  },
  addrLabelOn: {
    color: colors.ink,
  },
  addrPin: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkMuted,
  },
  addrPrimaryLine: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    color: colors.ink,
    marginTop: 3,
  },
  addrSecondaryLine: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },

  chips: { flexDirection: 'row', gap: 8, marginTop: space.lg, marginBottom: 2 },
  pair: { flexDirection: 'row', gap: space.sm },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },

  addNew: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md, marginTop: space.xs },
  addNewText: { fontFamily: fonts.semibold, fontSize: 14, color: brand.navy },
});
