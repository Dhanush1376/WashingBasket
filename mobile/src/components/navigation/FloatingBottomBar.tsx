import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../app/Icon';
import { haptic } from '../../lib/haptics';
import { colors } from '../../theme';

export type TabKey = 'Home' | 'Wallet' | 'Book' | 'Orders' | 'Profile';

export type TabItem = {
  name: TabKey;
  label: string;
  icon: IconName;
};

export const FLOATING_TABS: TabItem[] = [
  { name: 'Home', label: 'Home', icon: 'home' },
  { name: 'Wallet', label: 'Wallet', icon: 'wallet' },
  { name: 'Book', label: 'New order', icon: 'plus' },
  { name: 'Orders', label: 'Orders', icon: 'bag' },
  { name: 'Profile', label: 'Profile', icon: 'user' },
];

const NAV_INK = colors.ink;
const BUTTON = 46;

type Props = {
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
};

export function FloatingBottomBar({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  const handlePress = (tabName: TabKey) => {
    haptic.tap();
    if (onTabPress) {
      onTabPress(tabName);
    } else {
      navigation.navigate('Main', { screen: tabName });
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {FLOATING_TABS.map((tab) => {
          const focused = activeTab === tab.name;
          return (
            <Pressable
              key={tab.name}
              onPress={() => handlePress(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              hitSlop={4}
              style={({ pressed }) => [
                styles.button,
                focused && styles.buttonOn,
                pressed && !focused && styles.buttonPressed,
                Platform.OS === 'web' && ({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as object),
              ]}
            >
              <Icon name={tab.icon} size={20} color={focused ? '#FFFFFF' : NAV_INK} strokeWidth={1.9} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 99,
  },
  pill: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 30px rgba(17, 17, 17, 0.10), 0 2px 6px rgba(17, 17, 17, 0.04)',
        } as object)
      : {
          shadowColor: '#111111',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.10,
          shadowRadius: 16,
          elevation: 8,
        }),
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonOn: { backgroundColor: colors.ink },
  buttonPressed: { backgroundColor: 'rgba(20, 33, 61, 0.08)' },
});

