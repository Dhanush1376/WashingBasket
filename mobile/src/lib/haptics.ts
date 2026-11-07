import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Haptics used sparingly: confirmations and rejections only, never on every tap. */
const native = Platform.OS === 'ios' || Platform.OS === 'android';

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
