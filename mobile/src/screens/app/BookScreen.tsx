import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../components/app/AppScreen';
import { ART, ART_TINT } from '../../components/app/art';
import { Icon } from '../../components/app/Icon';
import { Button, Card } from '../../components/app/primitives';
import { ErrorState, ListSkeleton, Skeleton } from '../../components/app/states';
import { TextArea } from '../../components/app/TextArea';
import { useAppUser } from '../../hooks/useAppUser';
import { haptic } from '../../lib/haptics';
import { dateParts, money } from '../../lib/format';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { TabProps } from '../../navigation/types';
import { getAddresses } from '../../services/mock/account.service';
import { createBooking, getPickupDays } from '../../services/mock/booking.service';
import { computeTotals, getServices, itemsForService } from '../../services/mock/pricing.service';
import { useSession } from '../../session/session';
import { app, colors, fonts, shape, space, text } from '../../theme';
import type { ServiceId } from '../../types/models';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/** Guided booking: service → garments → address → date & slot → notes, with a live estimate. */
export function BookScreen({ navigation, route }: TabProps<'Book'>) {
  const { guest } = useAppUser();
  const { signOut } = useSession();
  const services = useQuery(keys.services, getServices);
  const addresses = useQuery(keys.addresses, getAddresses);
  const days = useQuery(keys.pickupDays, getPickupDays);

  const [serviceId, setServiceId] = useState<ServiceId | null>(route.params?.serviceId ?? null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [addressId, setAddressId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // A service chosen elsewhere (dashboard card) preselects here
  useEffect(() => {
    if (route.params?.serviceId) {
      setServiceId(route.params.serviceId);
      setQty({});
    }
  }, [route.params?.serviceId]);

  // Default address and the first open day, once loaded
  useEffect(() => {
    if (!addressId && addresses.data?.length) setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id);
  }, [addresses.data, addressId]);
  useEffect(() => {
    if (!day && days.data?.length) setDay(days.data[0].date);
  }, [days.data, day]);

  const items = serviceId ? itemsForService(serviceId) : [];
  const totals = useMemo(
    () => computeTotals(Object.entries(qty).map(([priceItemId, q]) => ({ priceItemId, qty: q }))),
    [qty],
  );
  const slots = days.data?.find((d) => d.date === day)?.slots ?? [];
  const ready = !!serviceId && !!addressId && !!day && !!slotId;

  const change = (id: string, delta: number) => {
    haptic.tap();
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(30, (q[id] ?? 0) + delta)) }));
  };

  const confirm = async () => {
    if (guest) {
      signOut(); // leaves guest mode for sign-in
      return;
    }
    if (!ready || submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      const request = await createBooking({ serviceId, pickupDate: day, slotId, addressId, notes });
      invalidate(keys.requests, keys.notifications, keys.dashboard);
      haptic.success();
      // reset for the next booking, then show the confirmation
      setQty({});
      setSlotId(null);
      setNotes('');
      navigation.navigate('BookingSuccess', { requestId: request.id });
    } catch {
      setFailed(true);
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  };

  const loadError = services.error || addresses.error || days.error;

  return (
    <AppScreen
      title="Book a pickup"
      subtitle="Collected from your door, returned fresh"
      leading="menu"
      footer={
        <View>
          {failed ? <Text style={styles.error}>We couldn't book that pickup. Please try again.</Text> : null}
          {/* one compact row, so the steps keep the room on small phones */}
          <View style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.total}>{totals.subtotal ? money(totals.total) : 'Priced at pickup'}</Text>
              <Text style={text.caption} numberOfLines={1}>
                {totals.subtotal
                  ? totals.delivery
                    ? `Estimate · incl. ${money(totals.delivery)} delivery`
                    : 'Estimate · free delivery'
                  : 'Weighed and counted at pickup'}
              </Text>
            </View>
            <Button
              label={guest ? 'Sign in to book' : 'Confirm'}
              icon="arrowRight"
              onPress={confirm}
              loading={submitting}
              disabled={!guest && !ready}
              style={styles.confirm}
            />
          </View>
        </View>
      }
    >
      {loadError ? (
        <ErrorState onRetry={() => invalidate(keys.services, keys.addresses, keys.pickupDays)} />
      ) : (
        <>
          <Step n={1} title="Choose a service" />
          {services.loading ? (
            <Skeleton height={120} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={styles.bleed}>
              {services.data?.map((s) => {
                const on = s.id === serviceId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      haptic.tap();
                      setServiceId(s.id);
                      setQty({});
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={s.name}
                    style={({ pressed }) => [styles.service, on && styles.serviceOn, webCursor, pressed && { opacity: 0.9 }]}
                  >
                    <View style={[styles.serviceArt, { backgroundColor: ART_TINT[s.art] ?? app.cream }]}>
                      <Image source={ART[s.art]} style={styles.fill} resizeMode="cover" />
                    </View>
                    <Text style={[styles.serviceName, on && { color: '#FFFFFF' }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[text.caption, on && { color: 'rgba(255,255,255,0.7)' }]}>{s.turnaround}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Step n={2} title="Add garments" hint="Optional · helps us estimate" />
          <Card style={styles.cardTight}>
            {!serviceId ? (
              <Text style={text.body}>Pick a service to see its items and prices.</Text>
            ) : (
              items.map((it, i) => (
                <View key={it.id} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={text.bodyStrong}>{it.name}</Text>
                    <Text style={text.caption}>
                      {money(it.price)} / {it.unit}
                    </Text>
                  </View>
                  <Stepper value={qty[it.id] ?? 0} unit={it.unit} onMinus={() => change(it.id, -1)} onPlus={() => change(it.id, 1)} label={it.name} />
                </View>
              ))
            )}
          </Card>

          <Step n={3} title="Pickup address" />
          {addresses.loading ? (
            <ListSkeleton rows={2} height={72} />
          ) : (
            <View style={{ gap: space.sm }}>
              {addresses.data?.map((a) => {
                const on = a.id === addressId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAddressId(a.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.address, on && styles.addressOn, webCursor, pressed && { opacity: 0.9 }]}
                  >
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={text.bodyStrong}>{a.label}</Text>
                      <Text style={text.caption} numberOfLines={2}>
                        {a.line1}, {a.line2}, {a.city} {a.pincode}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => navigation.navigate('AddAddress')} style={({ pressed }) => [styles.addAddress, webCursor, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <Icon name="plus" size={18} color={colors.navy} />
                <Text style={styles.addAddressText}>Add a new address</Text>
              </Pressable>
            </View>
          )}

          <Step n={4} title="Pickup date and time" />
          {days.loading ? (
            <Skeleton height={140} />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} style={styles.bleed}>
                {days.data?.map((d) => {
                  const p = dateParts(d.date);
                  const on = d.date === day;
                  const free = d.slots.some((s) => s.available);
                  return (
                    <Pressable
                      key={d.date}
                      disabled={!free}
                      onPress={() => {
                        setDay(d.date);
                        setSlotId(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: !free }}
                      accessibilityLabel={`${p.weekday} ${p.day} ${p.month}`}
                      style={[styles.dateChip, on && styles.dateChipOn, !free && { opacity: 0.4 }, webCursor]}
                    >
                      <Text style={[styles.dateWeek, on && styles.onText]}>{p.weekday}</Text>
                      <Text style={[styles.dateDay, on && styles.onText]}>{p.day}</Text>
                      <Text style={[styles.dateWeek, on && styles.onText]}>{p.month}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.slots}>
                {slots.map((s) => {
                  const on = s.id === slotId;
                  return (
                    <Pressable
                      key={s.id}
                      disabled={!s.available}
                      onPress={() => {
                        haptic.tap();
                        setSlotId(s.id);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: !s.available }}
                      accessibilityLabel={`${s.label}${s.available ? '' : ', full'}`}
                      style={[styles.slot, on && styles.slotOn, !s.available && styles.slotFull, webCursor]}
                    >
                      <Text style={[styles.slotPeriod, on && styles.onTextSoft]}>{s.available ? s.period : 'Full'}</Text>
                      <Text style={[styles.slotLabel, on && styles.onText, !s.available && { textDecorationLine: 'line-through' }]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Step n={5} title="Instructions" hint="Optional" />
          <TextArea
            label="Anything we should know?"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Gate code, delicate items, call on arrival"
            maxLength={240}
            hint={`${notes.length}/240`}
          />
        </>
      )}
    </AppScreen>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={[text.h2, { flex: 1 }]}>{title}</Text>
      {hint ? <Text style={text.caption}>{hint}</Text> : null}
    </View>
  );
}

function Stepper({ value, unit, onMinus, onPlus, label }: { value: number; unit: string; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} disabled={value === 0} hitSlop={6} accessibilityLabel={`Fewer ${label}`} style={[styles.stepBtn, value === 0 && { opacity: 0.35 }, webCursor]}>
        <Icon name="minus" size={16} color={colors.ink} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${value} ${unit}`}>
        {value}
        {unit === 'kg' && value ? <Text style={text.caption}> kg</Text> : null}
      </Text>
      <Pressable onPress={onPlus} hitSlop={6} accessibilityLabel={`More ${label}`} style={[styles.stepBtn, styles.stepBtnPlus, webCursor]}>
        <Icon name="plus" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  bleed: { marginHorizontal: -space.lg },
  hScroll: { paddingHorizontal: space.lg, gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxl, marginBottom: space.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFFFFF' },
  service: { width: 132, padding: space.sm, paddingBottom: space.md, borderRadius: shape.tile, backgroundColor: app.card },
  serviceOn: { backgroundColor: colors.ink },
  serviceArt: { height: 84, borderRadius: 14, overflow: 'hidden', marginBottom: space.sm },
  serviceName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, paddingHorizontal: 2 },
  cardTight: { paddingVertical: space.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  itemDivider: { borderTopWidth: 1, borderTopColor: app.hairline },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: app.cream, alignItems: 'center', justifyContent: 'center' },
  stepBtnPlus: { backgroundColor: colors.ink },
  stepValue: { minWidth: 30, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  address: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: shape.tile, backgroundColor: app.card, borderWidth: 1.5, borderColor: app.card },
  addressOn: { borderColor: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ink },
  addAddress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 24, borderWidth: 1.25, borderStyle: 'dashed', borderColor: colors.lineStrong },
  addAddressText: { fontFamily: fonts.medium, fontSize: 14, color: colors.navy },
  dateChip: { width: 64, paddingVertical: space.md, borderRadius: 20, backgroundColor: app.card, alignItems: 'center', gap: 2 },
  dateChipOn: { backgroundColor: colors.ink },
  dateWeek: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
  dateDay: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
  onText: { color: '#FFFFFF' },
  onTextSoft: { color: 'rgba(255,255,255,0.7)' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  slot: { width: '48.5%', padding: space.md, borderRadius: 16, backgroundColor: app.card },
  slotOn: { backgroundColor: colors.ink },
  slotFull: { backgroundColor: 'transparent', borderWidth: 1, borderColor: app.hairline },
  slotPeriod: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
  slotLabel: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, marginTop: 2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { ...text.amount, fontSize: 19, lineHeight: 24 },
  confirm: { minWidth: 150 },
  error: { ...text.caption, color: colors.danger, marginBottom: space.sm },
});
