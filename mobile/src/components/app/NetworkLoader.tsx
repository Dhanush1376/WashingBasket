import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { refetchAll, watchFirstLoads, watchRefreshing } from '../../lib/query';
import { LoadingOverlay } from './LoadingOverlay';

// Threshold for showing loader when first load is underway (250ms ensures responsiveness)
const SLOW_MS = 250;

const browserOffline = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Puts the app's full-screen logo loader up when it's needed:
 * - whenever an app-wide refresh is triggered (pull-to-refresh, manual reload);
 * - when a page's initial load takes a noticeable beat;
 * - when the connection drops ("You're offline").
 */
export function NetworkLoader() {
  const [slow, setSlow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(browserOffline);

  useEffect(() => {
    const stopRefresh = watchRefreshing(setRefreshing);
    return () => {
      stopRefresh();
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchFirstLoads((count) => {
      if (count > 0 && !timer) timer = setTimeout(() => setSlow(true), SLOW_MS);
      if (count === 0) {
        if (timer) clearTimeout(timer);
        timer = undefined;
        setSlow(false);
      }
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const back = () => {
      setOffline(false);
      refetchAll();
    };
    const gone = () => setOffline(true);
    window.addEventListener('online', back);
    window.addEventListener('offline', gone);
    return () => {
      window.removeEventListener('online', back);
      window.removeEventListener('offline', gone);
    };
  }, []);

  const retry = () => {
    if (browserOffline()) return;
    setOffline(false);
    refetchAll();
  };

  return (
    <LoadingOverlay
      visible={offline || slow || refreshing}
      label={offline ? "You're offline" : refreshing ? 'Refreshing...' : 'Loading'}
      message={offline ? "You're offline" : refreshing ? 'Refreshing...' : undefined}
      detail={offline ? "Check your connection. We'll carry on from here as soon as you're back." : undefined}
      action={offline ? { label: 'Try again', onPress: retry } : undefined}
    />
  );
}
