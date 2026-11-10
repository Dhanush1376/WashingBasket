import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics used sparingly: confirmations and rejections only, never on every tap. iPhone only: Android has no
 * light tick like the Taptic Engine, so on most phones the same calls are a coarse buzz on every press.
 */
const native = Platform.OS === 'ios';

export const haptic = {
  success() {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  tap() {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};
