import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../components/app/Icon';
import { haptic } from '../lib/haptics';
import { StaffHomeScreen } from '../screens/staff/StaffHomeScreen';
import { StaffOrdersScreen } from '../screens/staff/StaffOrdersScreen';
import { StaffProfileScreen } from '../screens/staff/StaffProfileScreen';
import { StaffScanScreen } from '../screens/staff/StaffScanScreen';
import { StaffScheduleScreen } from '../screens/staff/StaffScheduleScreen';
import { app, colors } from '../theme';
import type { StaffTabParamList } from './types';

const Tab = createBottomTabNavigator<StaffTabParamList>();

const TABS: Record<keyof StaffTabParamList, { label: string; icon: IconName }> = {
  StaffHome: { label: 'Home', icon: 'home' },
  StaffOrders: { label: 'Orders', icon: 'bag' },
  StaffScan: { label: 'Scan', icon: 'scan' },
  StaffSchedule: { label: 'Schedule', icon: 'calendar' },
  StaffProfile: { label: 'Profile', icon: 'user' },
};

/** The staff app's five places, under the same floating pill of round buttons as the customer app. */
export function StaffTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
        sceneStyle: { backgroundColor: app.canvas },
        animation: 'fade',
      }}
      tabBar={(props) => <StaffTabBar {...props} />}
    >
      <Tab.Screen name="StaffHome" component={StaffHomeScreen} />
      <Tab.Screen name="StaffOrders" component={StaffOrdersScreen} />
      <Tab.Screen name="StaffScan" component={StaffScanScreen} />
      <Tab.Screen name="StaffSchedule" component={StaffScheduleScreen} />
      <Tab.Screen name="StaffProfile" component={StaffProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * The customer app's tab bar: a floating white pill, the current tab solid ink. Scan, the job's main tool, rests in
 * a soft orange tint so it's easy to find without shouting. The bar steps aside while the keyboard is up.
 */
function StaffTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[route.name as keyof StaffTabParamList];
          const scan = route.name === 'StaffScan';
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              // the Scan tab always opens as a fresh, general scanner when chosen from the bar
              navigation.navigate(route.name, scan ? { intent: 'ANY', orderId: undefined, nonce: Date.now() } : route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              hitSlop={4}
              style={({ pressed }) => [
                styles.button,
                scan && !focused && styles.scan,
                focused && styles.buttonOn,
                pressed && !focused && styles.buttonPressed,
                Platform.OS === 'web' && ({ cursor: 'pointer', transition: 'background-color 0.2s ease' } as object),
              ]}
            >
              <Icon name={tab.icon} size={20} color={focused ? '#FFFFFF' : scan ? colors.logoOrange : colors.ink} strokeWidth={scan ? 2.1 : 1.9} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const BUTTON = 46;

const styles = StyleSheet.create({
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent', paddingTop: 8, paddingHorizontal: 16, alignItems: 'center' },
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
      ? ({ boxShadow: '0 8px 30px rgba(17, 17, 17, 0.10), 0 2px 6px rgba(17, 17, 17, 0.04)' } as object)
      : { shadowColor: '#111111', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 }),
  },
  button: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  scan: { backgroundColor: '#FFF1DF' },
  buttonOn: { backgroundColor: colors.ink },
  buttonPressed: { backgroundColor: 'rgba(20, 33, 61, 0.08)' },
});
