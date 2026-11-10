import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '../components/app/Icon';
import { LoadingOverlay } from '../components/app/LoadingOverlay';
import { haptic } from '../lib/haptics';
import { HomeScreen } from '../screens/app/HomeScreen';
import { OrdersScreen } from '../screens/app/OrdersScreen';
import { WalletScreen } from '../screens/app/WalletScreen';
import { NewOrderScreen } from '../screens/laundry/NewOrderScreen';
import { ProfileScreen } from '../screens/app/ProfileScreen';
import { app, colors } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS: Record<keyof MainTabParamList, { label: string; icon: IconName }> = {
  Home: { label: 'Home', icon: 'home' },
  Wallet: { label: 'Wallet', icon: 'wallet' },
  Book: { label: 'New order', icon: 'plus' },
  Orders: { label: 'Orders', icon: 'bag' },
  Profile: { label: 'Profile', icon: 'user' },
};

/** The branded loader plays once per app launch, the first time the dashboard opens. */
let entryLoaderShown = false;
const LOADER_MS = 1500;

export function MainTabs() {
  const [loader, setLoader] = useState(!entryLoaderShown);

  return (
    <View style={styles.flex}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
          sceneStyle: { backgroundColor: app.canvas },
          animation: 'none',
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Wallet" component={WalletScreen} />
        <Tab.Screen name="Book" component={NewOrderScreen} />
        <Tab.Screen name="Orders" component={OrdersScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      {loader ? (
        <EntryLoader
          onDone={() => {
            entryLoaderShown = true;
            setLoader(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** Full-screen brand moment: the shared logo loader over the dashboard, then a soft fade into it. Skip goes straight in. */
function EntryLoader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), LOADER_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <LoadingOverlay visible={visible} onHidden={onDone} label="Loading your dashboard" corner={{ label: 'Skip', onPress: () => setVisible(false) }} />
  );
}

/** Bottom navigation: a floating white pill of round icon buttons; the current one is solid black. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[route.name as keyof MainTabParamList];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              navigation.navigate(route.name, route.params);
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

const NAV_INK = colors.ink;
const BUTTON = 46;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // the page behind melts into one calm, even tone: blurred far enough that no card shows through as a patch, colours
  // muted so nothing competes, and a light warm wash over it all, so the full-colour logo is the one thing to look at
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
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
