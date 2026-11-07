import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme';
import type { MenuSection } from '../../types/models';
import { Icon } from '../app/Icon';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const INK = '#0A1C3E';
const UNIT: Record<MenuSection['unit'], string> = { kg: 'kg', pair: 'pair', pc: 'pc' };
const DOT = [colors.orange, colors.navy, '#1F9D3A'];

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(40, 30, 10, 0.06)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 };

/** A small taste of the price list: three lines read like a menu (name, dotted leader, "from" price), and a link to the rest. */
export function PriceTeaser({ sections, onOpen }: { sections: MenuSection[]; onOpen: () => void }) {
  const lines = sections.slice(0, 3).map((s) => ({ id: s.id, title: s.title, unit: UNIT[s.unit], from: Math.min(...s.items.map((i) => i.price)) }));
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open the full price list"
      style={({ pressed }) => [styles.card, soft, webCursor, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="receipt" size={17} color={INK} strokeWidth={2.1} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Price list</Text>
          <Text style={styles.sub}>{sections.length} services, no hidden charges</Text>
        </View>
        <View style={styles.go}>
          <Icon name="arrowUpRight" size={15} color={INK} strokeWidth={2.2} />
        </View>
      </View>

      {lines.map((l, i) => (
        <View key={l.id} style={styles.line}>
          <View style={[styles.dot, { backgroundColor: DOT[i % DOT.length] }]} />
          <Text style={styles.name} numberOfLines={1}>
            {l.title}
          </Text>
          <View style={styles.leader} />
          <Text style={styles.price}>
            <Text style={styles.from}>from </Text>₹{l.from}
            <Text style={styles.from}> /{l.unit}</Text>
          </Text>
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEAE2', padding: 16, paddingBottom: 10, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FEC837', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 15.5, letterSpacing: -0.3, color: INK },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted, marginTop: 1 },
  go: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 9 },
  name: { fontFamily: fonts.medium, fontSize: 13.5, color: INK, flexShrink: 1 },
  leader: { flex: 1, minWidth: 14, marginHorizontal: 8, marginTop: 5, borderBottomWidth: 1.5, borderColor: '#E2DCCF', borderStyle: 'dotted' },
  price: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, fontVariant: ['tabular-nums'] },
  from: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkMuted },
});
