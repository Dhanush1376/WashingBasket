import React, { useContext, useEffect, useId, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContext, NavigationRouteContext, ThemeContext } from '@react-navigation/native';

/**
 * Draws drawers in the app's own window, over every screen and the tab bar, instead of in a separate Modal window.
 *
 * Android needs this. There every Modal is its own edge-to-edge window, and Android neither resizes that window
 * for the keyboard nor reports the keyboard to the app while it is open. So a drawer's fields ended up under the
 * keys, and the drawer couldn't follow them. In the app's own window the keyboard is tracked frame by frame, as it
 * is on iOS.
 *
 * The host sits once near the root (App.tsx). `useSheetPortal` hands it an element to draw. That element keeps the
 * screen's navigation, route and theme, because the host itself sits outside the navigator.
 */

type Entry = { id: string; node: React.ReactNode };
let entries: Entry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => entries;

function put(id: string, node: React.ReactNode) {
  const i = entries.findIndex((e) => e.id === id);
  entries = i === -1 ? [...entries, { id, node }] : entries.map((e) => (e.id === id ? { id, node } : e));
  emit();
}
function remove(id: string) {
  if (!entries.some((e) => e.id === id)) return;
  entries = entries.filter((e) => e.id !== id);
  emit();
}

export function SheetPortalHost() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!list.length) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.host]} pointerEvents="box-none">
      {list.map((e) => (
        <React.Fragment key={e.id}>{e.node}</React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    zIndex: 1000,
    elevation: 1000,
  },
});

/** Draws `node` in the host while it is not null; carries the caller's navigation, route and theme along. */
export function useSheetPortal(node: React.ReactNode | null) {
  const id = useId();
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    if (node == null) {
      remove(id);
      return;
    }
    put(
      id,
      <NavigationContext.Provider value={navigation}>
        <NavigationRouteContext.Provider value={route}>
          <ThemeContext.Provider value={theme}>{node}</ThemeContext.Provider>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>,
    );
  });
  useEffect(() => () => remove(id), [id]);
}
