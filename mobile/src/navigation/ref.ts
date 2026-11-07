import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/** Lets components outside a screen (the drawer) navigate and read the current route. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
