import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

let pendingParams: URLSearchParams | null = null;
let microtaskScheduled = false;

/**
 * Keeps a page's search, filter, page number or open record in the address bar, so links from
 * the Overview land on the right view and the browser's Back button behaves as people expect.
 * Supports consecutive / batched updates atomically without race conditions.
 */
export function useUrlState<T extends string = string>(key: string, fallback: NoInfer<T>): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = (params.get(key) as T | null) ?? fallback;
  const set = useCallback(
    (v: T) => {
      if (!pendingParams) {
        pendingParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : params);
      }
      if (v === fallback || v === '') {
        pendingParams.delete(key);
      } else {
        pendingParams.set(key, v);
      }
      // A new search, tab, or filter automatically starts from the first page
      if (key !== 'page' && key !== 'open') {
        pendingParams.delete('page');
      }

      const next = new URLSearchParams(pendingParams);
      setParams(next, { replace: key !== 'open' });

      if (!microtaskScheduled) {
        microtaskScheduled = true;
        queueMicrotask(() => {
          pendingParams = null;
          microtaskScheduled = false;
        });
      }
    },
    [key, fallback, params, setParams],
  );
  return [value, set];
}

/** The page number as a number. */
export function usePageParam(): [number, (p: number) => void] {
  const [raw, set] = useUrlState('page', '1');
  const page = Math.max(1, parseInt(raw, 10) || 1);
  return [page, (p: number) => set(String(p))];
}

/** Detects if the current viewport is mobile (<= 768px). */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint || (window.matchMedia ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      setIsMobile(window.innerWidth <= breakpoint || (window.matchMedia ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false));
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}

/**
 * View mode ('table' | 'grid').
 * Automatically defaults to 'grid' (Cards layout) on mobile screens (<= 768px),
 * and 'table' on desktop screens, unless explicitly chosen by the user in the URL.
 */
export function useViewMode(
  key: string = 'view',
  defaultDesktop: 'table' | 'grid' = 'table',
): ['table' | 'grid', (mode: 'table' | 'grid') => void] {
  const isMobile = useIsMobile(768);
  const fallback: 'table' | 'grid' = isMobile ? 'grid' : defaultDesktop;
  return useUrlState<'table' | 'grid'>(key, fallback);
}
