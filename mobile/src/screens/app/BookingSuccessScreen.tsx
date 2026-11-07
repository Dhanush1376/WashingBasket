import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingBottomBar } from '../../components/navigation/FloatingBottomBar';
import { ART } from '../../components/app/art';
import { Icon } from '../../components/app/Icon';
import { Button, Card, KeyValue } from '../../components/app/primitives';
import { dayDate } from '../../lib/format';
import { keys, useQuery } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { getAddresses } from '../../services/mock/account.service';
import { slotById } from '../../services/mock/booking.service';
import { serviceById } from '../../services/mock/pricing.service';
import { listRequests } from '../../services/mock/requests.service';
import { app, colors, space, text } from '../../theme';

/** Confirmation after booking. The request is a local simulation; the copy says it's awaiting confirmation. */
export function BookingSuccessScreen({ navigation, route }: ScreenProps<'BookingSuccess'>) {
  const insets = useSafeAreaInsets();
  const requests = useQuery(keys.requests, listRequests);
  const addresses = useQuery(keys.addresses, getAddresses);
  const r = requests.data?.find((x) => x.id === route.params.requestId);
  const address = addresses.data?.find((a) => a.id === r?.addressId);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + 88 }]}>
      <View style={styles.top}>
        <View style={styles.check}>
          <Icon name="check" size={34} color="#FFFFFF" strokeWidth={2.6} />
        </View>
        <Text style={[text.display, styles.center]}>Pickup requested</Text>
        <Text style={[text.body, styles.center, { marginTop: 6 }]}>
          Request {route.params.requestId} is awaiting confirmation. We'll notify you once a pickup partner is assigned.
        </Text>
      </View>

      {r ? (
        <Card style={styles.card}>
          <Image source={ART.collecting} style={styles.art} resizeMode="cover" />
          <KeyValue label="Service" value={serviceById(r.serviceId).name} />
          <KeyValue label="Date" value={dayDate(r.pickupDate)} />
          <KeyValue label="Time" value={slotById(r.slotId)?.label ?? ''} />
          <KeyValue label="Address" value={address?.label ?? ''} />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button label="View my orders" onPress={() => navigation.navigate('Main', { screen: 'Orders' })} />
        <Button label="Back to home" variant="outline" onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
      </View>
      <FloatingBottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: app.canvas, paddingHorizontal: space.lg, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingHorizontal: space.lg },
  check: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
    borderWidth: 8,
    borderColor: colors.successTint,
  },
  center: { textAlign: 'center' },
  card: { gap: 2 },
  art: { width: '100%', height: 120, borderRadius: 16, marginBottom: space.md },
  actions: { gap: space.md },
});
