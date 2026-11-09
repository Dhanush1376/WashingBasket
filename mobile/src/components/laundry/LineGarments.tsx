import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OrderLine } from '../../mock/types';
import { colors, fonts } from '../../theme';
import { GarmentIcon } from './GarmentIcon';

/**
 * The clothes a customer listed under one order line (e.g. 3 Shirt, 2 Jeans), for staff to count against.
 * Renders nothing for lines placed without a garment list.
 */
export function LineGarments({ line, indent = 0 }: { line: OrderLine; indent?: number }) {
  if (!line.garments?.length) return null;
  return (
    <View style={[styles.box, { marginLeft: indent }]} accessibilityLabel={`Listed clothes: ${line.garments.map((g) => `${g.qty} ${g.name}`).join(', ')}`}>
      {line.garments.map((g, i) => (
        <View key={g.garmentId} style={[styles.row, i > 0 && styles.rule]}>
          <GarmentIcon name={g.icon} size={26} />
          <Text style={styles.name} numberOfLines={1}>
            {g.name}
          </Text>
          <Text style={styles.qty}>× {g.qty}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 2, marginBottom: 10, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F6F4EE' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  rule: { borderTopWidth: 1, borderTopColor: '#E9E5DC' },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  qty: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
});
