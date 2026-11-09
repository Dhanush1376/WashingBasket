import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Icon } from '../app/Icon';

const SOFT_YELLOW = '#FED843'; // signature QR hero yellow from order detail
export const BASKET_PEEK = 42; // how much of the card shows above the sheet

/**
 * The live basket, peeking out above the order sheet as a soft yellow tab: what's in it on the left, where it's
 * going on the right, centred in the strip that shows.
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
        <Icon name="bag" size={13} color={colors.ink} strokeWidth={2.4} />
        <Text style={styles.label}>
          {pieces > 0 ? `Your basket · ₹${total}` : 'Your basket'}
        </Text>
      </View>
      {place ? (
        <View style={styles.right}>
          <Icon name="mapPin" size={11} color="rgba(10, 28, 62, 0.85)" strokeWidth={2.4} />
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
    height: BASKET_PEEK + 28,
    borderRadius: 22,
    backgroundColor: SOFT_YELLOW,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: (BASKET_PEEK - 18) / 2,
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
    fontSize: 13,
    letterSpacing: -0.1,
    color: colors.ink,
  },
  place: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: 'rgba(10, 28, 62, 0.85)',
    flexShrink: 1,
  },
});
