import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Country, COUNTRIES } from '../../data/countries';
import { colors, fonts, radius } from '../../theme';
import { CountryFlag } from '../ui/CountryFlag';
import { Check } from '../ui/icons';

type Props = {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
};

export function CountryPicker({ visible, selected, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close country list" />
        <Animated.View
          entering={SlideInDown.duration(320).springify().damping(22)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Select country</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(c) => c.iso}
            renderItem={({ item }) => {
              const active = item.iso === selected.iso;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={[styles.flagWrap, active && styles.flagWrapActive]}>
                    <CountryFlag iso={item.iso} width={28} height={19} />
                  </View>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.dial}>{item.dialCode}</Text>
                  <View style={styles.check}>{active && <Check size={18} color={colors.navy} />}</View>
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 33, 61, 0.38)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 12,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, paddingHorizontal: 12, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56, borderRadius: radius.sm, gap: 12 },
  itemPressed: { backgroundColor: colors.subtle },
  flagWrap: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagWrapActive: {
    backgroundColor: '#EEF4FF',
  },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  dial: { fontFamily: fonts.semibold, fontSize: 15, color: colors.inkSoft },
  check: { width: 20, alignItems: 'flex-end' },
});
