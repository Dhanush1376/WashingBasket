import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';

import { Country, formatNational, maxDigits } from '../../data/countries';
import { colors, CONTROL_HEIGHT, fonts, radius } from '../../theme';
import { CountryFlag } from '../ui/CountryFlag';
import { FIELD_BORDER, FloatingLabel } from '../ui/FloatingLabel';
import { Check, ChevronDown, ChevronUp, X } from '../ui/icons';

type Props = {
  country: Country;
  value: string;
  onChangeDigits: (digits: string) => void;
  onPressCountry: () => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  invalid?: boolean;
  editable?: boolean;
  dropdownOpen?: boolean;
};

export const PhoneInput = forwardRef<TextInputInstance, Props>(function PhoneInput(
  { country, value, onChangeDigits, onPressCountry, onSubmit, onFocus, onBlur, invalid, editable = true, dropdownOpen = false },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  // where the number starts: the label rests there, then floats to the field's top-left
  const [prefixW, setPrefixW] = useState(96);

  const isComplete = country.lengths.includes(value.length);
  const hasValue = value.length > 0;

  return (
    <View
      style={[
        styles.field,
        hovered && !focused && styles.fieldHovered,
        focused && styles.focused,
        invalid && styles.invalid,
      ]}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country code ${country.name} ${country.dialCode}. Change country`}
        onPress={onPressCountry}
        disabled={!editable}
        hitSlop={6}
        onLayout={(e) => setPrefixW(Math.round(e.nativeEvent.layout.width))}
        style={({ pressed }) => [styles.country, pressed && styles.countryPressed]}
      >
        <View style={styles.flagWrap}>
          <CountryFlag iso={country.iso} width={22} height={22} circle />
        </View>
        <Text style={styles.dial}>{country.dialCode}</Text>
        {dropdownOpen ? (
          <ChevronUp size={13} color={colors.inkMuted} />
        ) : (
          <ChevronDown size={13} color={colors.inkMuted} />
        )}
      </Pressable>

      <View style={styles.divider} />

      <TextInput
        ref={ref}
        style={[
          styles.input,
          Platform.OS === 'web' && ({ outlineStyle: 'none', outline: 'none' } as any),
        ]}
        value={formatNational(value, country)}
        onChangeText={(t) => onChangeDigits(t.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits(country)))}
        // the label stands in for the placeholder; the sample number shows once focused
        placeholder={focused ? formatNational('9876543210'.slice(0, maxDigits(country)), country) : undefined}
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        textContentType="telephoneNumber"
        autoComplete="tel-national"
        onSubmitEditing={onSubmit}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        editable={editable}
        maxLength={maxDigits(country) + country.groups.length}
        accessibilityLabel="Mobile number"
        selectionColor={colors.navy}
      />

      {hasValue && editable && (
        <View style={styles.trailing}>
          {isComplete && !invalid && !focused ? (
            <View style={styles.validBadge}>
              <Check size={12} color="#059669" strokeWidth={2.6} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear number"
              onPress={() => onChangeDigits('')}
              hitSlop={8}
              style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
            >
              <X size={12} color="#64748B" strokeWidth={2.4} />
            </Pressable>
          )}
        </View>
      )}

      <FloatingLabel
        label="Mobile number"
        raised={focused || hasValue}
        focused={focused}
        error={invalid}
        restLeft={prefixW + DIVIDER_SPACE + INPUT_PAD - 4}
      />
    </View>
  );
});

const DIVIDER_SPACE = 3; // divider width plus its margin
const INPUT_PAD = 12;

const styles = StyleSheet.create({
  field: {
    height: CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.field,
    borderWidth: FIELD_BORDER,
    borderColor: colors.lineStrong,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
        } as any)
      : {}),
  },
  fieldHovered: {
    borderColor: colors.inkMuted,
  },
  focused: {
    borderColor: colors.navy,
    backgroundColor: '#FFFFFF',
  },
  invalid: {
    borderColor: colors.danger,
    backgroundColor: '#FFFDFD',
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: '100%',
    paddingLeft: 16,
    paddingRight: 12,
    borderTopLeftRadius: radius.field,
    borderBottomLeftRadius: radius.field,
  },
  countryPressed: {
    backgroundColor: colors.line,
  },
  flagWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dial: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.lineStrong,
    marginRight: 2,
  },
  input: {
    flex: 1,
    minWidth: 0, // web inputs have an intrinsic width; let the field own it
    height: '100%',
    paddingLeft: 12,
    paddingRight: 16,
    fontFamily: fonts.medium,
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.ink,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  trailing: {
    paddingRight: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6E9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnPressed: {
    backgroundColor: '#E2E8F0',
  },
  validBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
