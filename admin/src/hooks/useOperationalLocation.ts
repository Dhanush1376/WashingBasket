import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const LOCATIONS = [
  { value: 'all', label: 'All locations', hint: 'All campus & outside hubs' },
  { value: 'loc-lpu', label: 'LPU', hint: 'LPU main campus' },
  { value: 'loc-nit', label: 'NIT Jalandhar', hint: 'NIT Jalandhar campus' },
  { value: 'loc-outside', label: 'Outside Campus', hint: 'City pickup & delivery' },
] as const;

export type LocationValue = (typeof LOCATIONS)[number]['value'];

const STORAGE_KEY = 'wb-admin.location';
const EVENT_KEY = 'wb:location-change';

export function getStoredLocation(): LocationValue {
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (val && LOCATIONS.some((l) => l.value === val)) {
      return val as LocationValue;
    }
  } catch {
    /* storage unavailable */
  }
  return 'all';
}

export function setStoredLocation(val: LocationValue) {
  try {
    window.localStorage.setItem(STORAGE_KEY, val);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: val }));
}

/**
 * Global operational location filter hook.
 * Syncs seamlessly across URL search params (?location=...), local storage, and page state.
 */
export function useOperationalLocation() {
  const routerLocation = useLocation();
  const navigate = useNavigate();

  const urlParam = new URLSearchParams(routerLocation.search).get('location');
  const validUrlParam = LOCATIONS.some((l) => l.value === urlParam) ? (urlParam as LocationValue) : null;

  const [storedLoc, setStoredLoc] = useState<LocationValue>(() => validUrlParam ?? getStoredLocation());

  // Listen for storage or custom events from other components
  useEffect(() => {
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent<LocationValue>).detail;
      if (detail && LOCATIONS.some((l) => l.value === detail)) {
        setStoredLoc(detail);
      } else {
        setStoredLoc(getStoredLocation());
      }
    };

    window.addEventListener(EVENT_KEY, handleEvent);
    window.addEventListener('storage', handleEvent);
    return () => {
      window.removeEventListener(EVENT_KEY, handleEvent);
      window.removeEventListener('storage', handleEvent);
    };
  }, []);

  // If URL changes, sync stored state
  useEffect(() => {
    if (validUrlParam && validUrlParam !== storedLoc) {
      setStoredLoc(validUrlParam);
      setStoredLocation(validUrlParam);
    }
  }, [validUrlParam, storedLoc]);

  const activeValue: LocationValue = validUrlParam ?? storedLoc;
  const activeItem = LOCATIONS.find((l) => l.value === activeValue) ?? LOCATIONS[0];

  const setLocation = useCallback(
    (newVal: LocationValue) => {
      setStoredLocation(newVal);
      setStoredLoc(newVal);

      // Preserve current path and other query parameters, update location
      const sp = new URLSearchParams(routerLocation.search);
      if (newVal === 'all') {
        sp.delete('location');
      } else {
        sp.set('location', newVal);
      }
      const search = sp.toString();
      navigate(
        {
          pathname: routerLocation.pathname,
          search: search ? `?${search}` : '',
        },
        { replace: true },
      );
    },
    [routerLocation.pathname, routerLocation.search, navigate],
  );

  return {
    location: activeValue,
    locationItem: activeItem,
    label: activeItem.label,
    isFiltered: activeValue !== 'all',
    setLocation,
  };
}
