import './src/laundry/setup';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { CourierPrime_400Regular, CourierPrime_700Bold } from '@expo-google-fonts/courier-prime';
import { Nunito_900Black } from '@expo-google-fonts/nunito';
import {
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingOverlay } from './src/components/app/LoadingOverlay';
import { NetworkLoader } from './src/components/app/NetworkLoader';
import { IntroSplashScreen } from './src/components/splash/IntroSplashScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SheetPortalHost } from './src/components/ui/SheetPortal';
import { PaymentCelebrationHost } from './src/components/app/PaymentCelebration';
import { LogoPreviewScreen } from './src/screens/LogoPreviewScreen';
import { preloadAppAssets } from './src/services/preloadAssets';
import { SessionProvider } from './src/session/session';
import { shouldPlayIntro, markIntroPlayed } from './src/session/introSession';
import { colors } from './src/theme';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'washing-basket-web-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body, #root {
        background-color: #FFFFFF !important;
      }
      ::selection {
        background-color: #FFA742 !important;
        color: #FFFFFF !important;
      }
      ::-moz-selection {
        background-color: #FFA742 !important;
        color: #FFFFFF !important;
      }
      input, textarea, select {
        outline: none !important;
        outline-style: none !important;
        background-color: transparent !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        outline-style: none !important;
        box-shadow: none !important;
        background-color: transparent !important;
      }
      input:-webkit-autofill,
      input:-webkit-autofill:hover, 
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #F4F2EB inset !important;
        box-shadow: 0 0 0 1000px #F4F2EB inset !important;
        -webkit-text-fill-color: #0A1C3E !important;
        caret-color: #0A1C3E !important;
        background-color: transparent !important;
        transition: background-color 50000s ease-in-out 0s;
      }
    `;
    document.head.appendChild(style);
  }
}

/** Development-only: open the web app with `?logo` to check the logo animations on their own. */
const LOGO_PREVIEW =
  __DEV__ && Platform.OS === 'web' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('logo');

// Start fetching the sign-in film and brand pictures right away, while the intro plays.
preloadAppAssets();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Nunito_900Black,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    // the printed laundry slip
    CourierPrime_400Regular,
    CourierPrime_700Bold,
  });

  // Intro animation ONLY plays on cold launch/open. Subsequent page refreshes/reloads skip it.
  const needsIntro = shouldPlayIntro();
  const [showIntro, setShowIntro] = useState(needsIntro);

  // When refreshing the page (intro skipped), the brand washing basket LogoLoader appears
  // while initial data and state settle, then smoothly fades out.
  const [initialRefreshLoading, setInitialRefreshLoading] = useState(!needsIntro);

  useEffect(() => {
    if (initialRefreshLoading) {
      const timer = setTimeout(() => {
        setInitialRefreshLoading(false);
      }, 850);
      return () => clearTimeout(timer);
    }
  }, [initialRefreshLoading]);

  const handleFinishIntro = useCallback(() => {
    markIntroPlayed();
    setShowIntro(false);
  }, []);

  // Fonts are bundled locally, so this is a single frame or two of brand background.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      {LOGO_PREVIEW ? (
        <LogoPreviewScreen />
      ) : (
        <SessionProvider>
          <RootNavigator />
          {/* Android drawers, drawn in the app's own window so they can follow the keyboard (see SheetPortal) */}
          <SheetPortalHost />
          {/* "Payment successful" toast and celebration pop-up, over every screen */}
          <PaymentCelebrationHost />
          {/* the logo loader, over everything, when a page is slow to load, connection drops, or refresh is underway */}
          <NetworkLoader />
          {/* on refresh / default reload when intro is not shown: show the washing basket LogoLoader */}
          <LoadingOverlay visible={initialRefreshLoading} label="Loading" />
          {/* intro animation ONLY comes when the user opens the app */}
          {showIntro ? <IntroSplashScreen onFinish={handleFinishIntro} /> : null}
        </SessionProvider>
      )}
    </SafeAreaProvider>
  );
}
