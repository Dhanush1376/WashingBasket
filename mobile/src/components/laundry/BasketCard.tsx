import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Icon } from '../app/Icon';

/**
 * Live basket card header styled in brand orange to match the notifications peek card.
 */
export function BasketCard({
  total,
  pieces,
  place,
}: {
  total: number;
  pieces: number;
  /** e.g. "LPU · Drop-off". */
  place?: string;
  steps?: string[];
  at?: number;
  onJump?: (i: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Icon name="bag" size={13} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={styles.label}>
          {pieces > 0 ? `Your basket · ₹${total}` : 'Your basket'}
        </Text>
      </View>
      {place ? (
        <View style={styles.right}>
          <Icon name="mapPin" size={11} color="rgba(255, 255, 255, 0.92)" strokeWidth={2.4} />
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 532,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.orange,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  place: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.95)',
    flexShrink: 1,
  },
});
