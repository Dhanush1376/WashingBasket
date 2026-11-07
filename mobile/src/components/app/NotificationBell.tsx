import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';

import { keys, useQuery } from '../../lib/query';
import type { RootStackParamList } from '../../navigation/types';
import { listNotifications } from '../../services/mock/engagement.service';
import { IconButton } from './primitives';

/** The round bell in every page header, with the unread count, opening Notifications. */
export function NotificationBell({ tone }: { tone?: 'white' | 'stone' }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const notifications = useQuery(keys.notifications, listNotifications);
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  return <IconButton icon="bell" label="Notifications" tone={tone} badge={unread} onPress={() => navigation.navigate('Notifications')} />;
}
