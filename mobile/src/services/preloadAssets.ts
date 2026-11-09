import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';

/** The sign-in film. 4 MB, so on phones it is fetched once to a local file and played from there. */
export const HERO_VIDEO: number = require('../../assets/video/washing-basket-hero.mp4');

/** In the order they are first seen: the sign-in screen, then Home and order pictures. */
const PRELOAD_IMAGES: number[] = [
  require('../../assets/video/washing-basket-hero-poster.jpg'),
  require('../../assets/illustrations/otp-washing.png'),
  require('../../assets/illustrations/pincode-ironing.png'),
  require('../../assets/illustrations/details-drying.png'),
  require('../../assets/illustrations/unavailable-map-pin.png'),
  require('../../assets/scenes/collecting.jpg'),
  require('../../assets/scenes/washing.jpg'),
  require('../../assets/scenes/drying.jpg'),
  require('../../assets/scenes/ironing.jpg'),
  require('../../assets/scenes/packing.jpg'),
  require('../../assets/scenes/delivery.jpg'),
  require('../../assets/services/blanket.png'),
  require('../../assets/services/color dye.png'),
  require('../../assets/services/dry clean.png'),
  require('../../assets/services/shoes, bags and soft toys.png'),
  require('../../assets/services/stain treatment.png'),
  require('../../assets/logos/lpu.png'),
  require('../../assets/logos/nitj.png'),
];

let started = false;
let heroUri: string | null = null;
let heroPromise: Promise<string | null> | null = null;

const isRemote = (uri?: string) => !!uri && /^https?:/.test(uri);
/** Where a bundled picture is served from (works on iOS, Android and web, unlike Image.resolveAssetSource). */
const uriOf = (source: number): string | undefined => {
  try {
    return Asset.fromModule(source).uri;
  } catch {
    return undefined;
  }
};

/**
 * Loads the film into a local file. In development (Expo Go) assets come from the dev server
 * over the network, and streaming a 4 MB video from it is slow or stalls; a local file starts
 * at once. In a release build the file is already on the device and this resolves immediately.
 */
function loadHeroVideo(): Promise<string | null> {
  if (heroPromise) return heroPromise;
  heroPromise =
    Platform.OS === 'web'
      ? Promise.resolve(null) // the browser streams it with range requests
      : Asset.fromModule(HERO_VIDEO)
          .downloadAsync()
          .then((a) => (heroUri = a.localUri ?? null))
          .catch(() => null);
  return heroPromise;
}

/** Warms the image cache one picture at a time, so pictures appear at once instead of popping in. */
async function warmImages() {
  for (const source of PRELOAD_IMAGES) {
    const uri = uriOf(source);
    // file:// in release builds needs no warming
    if (!isRemote(uri)) continue;
    try {
      await Image.prefetch(uri!);
    } catch {
      // a picture that fails here simply loads when it is shown
    }
  }
}

/**
 * Starts fetching the film and every brand picture as the app opens, while the intro plays.
 * Never blocks a frame; safe to call more than once.
 */
export function preloadAppAssets(): void {
  if (started) return;
  started = true;
  try {
    // the poster first: it is the very first picture a new customer sees
    const poster = uriOf(PRELOAD_IMAGES[0]);
    if (isRemote(poster)) Image.prefetch(poster!).catch(() => {});
    loadHeroVideo().finally(() => {
      warmImages();
    });
  } catch {
    // preloading is only a speed-up; it must never stop the app from opening
  }
}

/**
 * The film's source for the player: the local file once it is ready on phones, the asset
 * itself on web. `null` while it is still downloading, so the poster shows meanwhile.
 */
export function useHeroVideoSource(): number | { uri: string } | null {
  // undefined = still downloading, null = download failed, string = local file
  const [uri, setUri] = useState<string | null | undefined>(heroUri ?? undefined);
  useEffect(() => {
    if (Platform.OS === 'web' || heroUri) return;
    let alive = true;
    loadHeroVideo().then((u) => {
      if (alive) setUri(u);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (Platform.OS === 'web') return HERO_VIDEO;
  if (uri === undefined) return null;
  // a failed download falls back to the asset itself rather than showing no film at all
  return uri ? { uri } : HERO_VIDEO;
}
