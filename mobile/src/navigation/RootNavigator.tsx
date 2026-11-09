import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, View } from 'react-native';

import { AddAddressScreen } from '../screens/app/AddAddressScreen';
import { BookingSuccessScreen } from '../screens/app/BookingSuccessScreen';
import { EditProfileScreen } from '../screens/app/EditProfileScreen';
import { IntroScreen } from '../screens/app/IntroScreen';
import { NotificationsScreen } from '../screens/app/NotificationsScreen';
import { OffersScreen } from '../screens/app/OffersScreen';
import { OrderDetailScreen } from '../screens/app/OrderDetailScreen';
import { PriceListScreen } from '../screens/app/PriceListScreen';
import { ReferScreen } from '../screens/app/ReferScreen';
import { SupportScreen } from '../screens/app/SupportScreen';
import { LaundryOrderScreen } from '../screens/laundry/LaundryOrderScreen';
import { ReceiptScreen } from '../screens/laundry/ReceiptScreen';
import { VerifyClothesScreen } from '../screens/laundry/VerifyClothesScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { StaffDeliveryScreen } from '../screens/staff/StaffDeliveryScreen';
import { StaffNotificationsScreen } from '../screens/staff/StaffNotificationsScreen';
import { StaffOrderScreen } from '../screens/staff/StaffOrderScreen';
import { StaffReviewScreen } from '../screens/staff/StaffReviewScreen';
import { StaffSalaryScreen } from '../screens/staff/StaffSalaryScreen';
import { LaundryBridge } from '../laundry/LaundryBridge';
import { useSession } from '../session/session';
import { app, colors } from '../theme';
import { DrawerProvider } from './AppDrawer';
import { MainTabs } from './MainTabs';
import { navigationRef } from './ref';
import { StaffTabs } from './StaffTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.navy, text: colors.ink },
};

/**
 * Screens are chosen from the onboarding stage: finished users get the app; everyone else gets
 * the one sign-in page, which shows their remaining step (code, details or PIN code) in its sheet.
 */
export function RootNavigator() {
  const { ready, session, guest } = useSession();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const stage = session?.stage;
  const isStaff = !!session && session.role === 'staff' && stage === 'ONBOARDING_COMPLETED' && !!session.staffId;
  return (
    <NavigationContainer theme={theme} ref={navigationRef}>
      <DrawerProvider>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: app.canvas },
            animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
            // unhurried screen changes, never a snap
            animationDuration: Platform.OS === 'web' ? 200 : 320,
          }}
        >
          {isStaff ? (
            // staff signed in with the demo staff number: five tabs for their branch's work, nothing of the customer app
            <Stack.Group screenOptions={{ contentStyle: { backgroundColor: app.canvas } }}>
              <Stack.Screen name="StaffTabs" component={StaffTabs} options={{ animation: 'fade' }} />
              <Stack.Screen name="StaffOrder" component={StaffOrderScreen} />
              <Stack.Screen name="StaffReview" component={StaffReviewScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="StaffDelivery" component={StaffDeliveryScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="StaffNotifications" component={StaffNotificationsScreen} />
              <Stack.Screen name="StaffSalary" component={StaffSalaryScreen} />
            </Stack.Group>
          ) : (session && session.role !== 'staff' && stage === 'ONBOARDING_COMPLETED') || (!session && guest) ? (
            // the customer app: tabs, plus the screens pushed over them
            <Stack.Group screenOptions={{ contentStyle: { backgroundColor: app.canvas } }}>
              <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />
              <Stack.Screen name="OrderDetail" component={LaundryOrderScreen as React.ComponentType<any>} />
              <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="Offers" component={OffersScreen} />
              <Stack.Screen name="Refer" component={ReferScreen} />
              <Stack.Screen name="PriceList" component={PriceListScreen} />
              <Stack.Screen name="Support" component={SupportScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="AddAddress" component={AddAddressScreen} />
              <Stack.Screen name="Intro" component={IntroScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="LaundryOrder" component={LaundryOrderScreen} />
              <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="VerifyClothes" component={VerifyClothesScreen} />
            </Stack.Group>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          )}
        </Stack.Navigator>
        <LaundryBridge />
      </DrawerProvider>
    </NavigationContainer>
  );
}
