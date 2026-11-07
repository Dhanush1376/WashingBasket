import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Country, COUNTRIES } from '../../data/countries';
import { colors, fonts } from '../../theme';
import { CountryFlag } from '../ui/CountryFlag';
import { Check } from '../ui/icons';

type Props = {
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
};

export function CountryDropdown({ selected, onSelect, onClose }: Props) {
  const dropdownRef = useRef<any>(null);

  // Close when clicking outside on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = dropdownRef.current as any;
      if (el && (el === target || el.contains?.(target))) {
        return;
      }
      onClose();
    };

    const id = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 50);

    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <>
      {/* Invisible backdrop to dismiss dropdown on click outside */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close dropdown" />

      <Animated.View
        ref={dropdownRef}
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(120)}
        style={styles.dropdown}
      >
        <ScrollView
          style={styles.scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {COUNTRIES.map((item) => {
            const active = item.iso === selected.iso;
            return (
              <Pressable
                key={item.iso}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={styles.flag}>
                  <CountryFlag iso={item.iso} width={22} height={22} circle />
                </View>
                <Text style={[styles.name, active && styles.nameActive]}>{item.name}</Text>
                <Text style={styles.dial}>{item.dialCode}</Text>
                <View style={styles.check}>{active && <Check size={16} color={colors.navy} />}</View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    zIndex: 90,
  },
  dropdown: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    maxHeight: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 20,
        }),
  },
  scroll: {
    maxHeight: 260,
    paddingVertical: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  itemActive: {
    backgroundColor: '#F8FAFC',
  },
  itemPressed: {
    backgroundColor: '#F1F5F9',
  },
  flag: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    color: colors.ink,
  },
  nameActive: {
    fontFamily: fonts.bold,
    color: colors.navy,
  },
  dial: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.inkSoft,
  },
  check: {
    width: 18,
    alignItems: 'flex-end',
  },
});
