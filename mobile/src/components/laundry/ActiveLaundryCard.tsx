import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCurrentCustomer, useLaundryState } from '../../laundry/hooks';
import { money, plural } from '../../lib/format';
import { isOpen, STATUS_COPY } from '../../mock/engine/lifecycle';
import { get5StepJourney } from './OrderTimeline';
import { findLocation, ordersForCustomer } from '../../mock/engine/selectors';
import type { LaundryOrder } from '../../mock/types';
import { app, colors, fonts, space } from '../../theme';
import { Icon } from '../app/Icon';

/** What the customer should do next on this order, if anything. */
function nextStep(o: LaundryOrder): string {
  switch (o.status) {
    case 'PAYMENT_PENDING':
      return `Pay ${money(o.total)} to unlock your QR`;
    case 'AWAITING_STAFF_ACCEPTANCE':
      return o.serviceMode === 'HOME_PICKUP' ? 'Show your QR to the pickup partner' : 'Show your QR at the counter';
    case 'READY_FOR_DELIVERY':
      return 'Ready — check your clothes';
    case 'AWAITING_CUSTOMER_VERIFICATION':
      return o.verification ? 'Show your delivery QR' : 'Check your clothes';
    default:
      return STATUS_COPY[o.status].customer[o.serviceMode];
  }
}

/** Home's live card for the customer's open laundry orders: the one most in need of them leads. */
export function ActiveLaundryCard({ onOpen, onAll }: { onOpen: (orderId: string) => void; onAll: () => void }) {
  const state = useLaundryState();
  const customer = useCurrentCustomer();
  if (!state || !customer) return null;
  const open = ordersForCustomer(state, customer.id).filter((o) => isOpen(o.status));
  if (!open.length) return null;
  const needsYou = (o: LaundryOrder) => ['PAYMENT_PENDING', 'AWAITING_STAFF_ACCEPTANCE', 'READY_FOR_DELIVERY', 'AWAITING_CUSTOMER_VERIFICATION'].includes(o.status);
  const lead = open.find(needsYou) ?? open[0];
  const progress = get5StepJourney(lead, state);
  const steps = progress.steps.slice(0, 5);
  const at = progress.stepIndex - 1;
  const location = findLocation(state, lead.locationId);

  // "See all" sits over the card as a sibling rather than inside it, so no button is nested in another
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onOpen(lead.id)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${lead.id}, ${STATUS_COPY[lead.status].label}. ${nextStep(lead)}`}
        style={({ pressed }) => [styles.card, Platform.OS === 'web' && ({ cursor: 'pointer' } as object), pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}
      >
        <View style={styles.top}>
          <View style={styles.kicker}>
            <View style={styles.dot} />
            <Text style={styles.kickerText}>{needsYou(lead) ? 'Needs you' : 'In progress'}</Text>
          </View>
        </View>
        <Text style={styles.title}>{nextStep(lead)}</Text>
        <Text style={styles.meta}>
          {lead.id} · {plural(lead.pieces, 'piece')}
        </Text>
        <View style={styles.track} accessibilityElementsHidden>
          {steps.map((st, i) => (
            <View key={st.key} style={[styles.seg, i <= at && styles.segOn]} />
          ))}
        </View>
        <View style={styles.bottom}>
          <Text style={styles.status}>{STATUS_COPY[lead.status].label}</Text>
          <View style={styles.go}>
            <Icon name="arrowUpRight" size={16} color={colors.ink} />
          </View>
        </View>
      </Pressable>
      {open.length > 1 ? (
        <Pressable
          onPress={onAll}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`All ${open.length} open orders`}
          style={[styles.allBtn, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
        >
          <Text style={styles.all}>{open.length} open · See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  card: { borderRadius: 26, backgroundColor: app.navyDeep, padding: space.xl },
  allBtn: { position: 'absolute', top: space.xl, right: space.xl },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },
  kickerText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  all: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFFFFF' },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    marginTop: space.md,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  track: { flexDirection: 'row', gap: 4, marginTop: space.lg },
  seg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  segOn: { backgroundColor: colors.orange },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
  },
  status: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  go: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
