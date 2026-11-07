import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The same small data hook the customer app uses (mobile/src/lib/query.ts), for the web:
 * - results are cached per key, so going back to a page shows data at once and refreshes quietly;
 * - after any change, `refreshAll()` refetches every query on screen, so every number agrees.
 */
const cache = new Map<string, unknown>();
const subscribers = new Map<string, Set<() => void>>();

export function refreshAll() {
  subscribers.forEach((set) => set.forEach((fn) => fn()));
}

export type Query<T> = {
  data: T | undefined;
  error: Error | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  refetch: () => void;
};

export function useQuery<T>(key: string, fetcher: () => Promise<T>): Query<T> {
  const [data, setData] = useState<T | undefined>(() => cache.get(key) as T | undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!cache.has(key));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const cancelRef = useRef<() => void>(() => {});

  const run = useCallback(() => {
    cancelRef.current();
    let alive = true;
    cancelRef.current = () => {
      alive = false;
    };
    if (!cache.has(key)) setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((value) => {
        cache.set(key, value);
        if (alive) setData(value);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        cache.delete(key);
        setData(undefined);
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => alive && setLoading(false));
  }, [key]);

  useEffect(() => {
    setData(cache.get(key) as T | undefined);
    run();
    const set = subscribers.get(key) ?? new Set();
    set.add(run);
    subscribers.set(key, set);
    return () => {
      cancelRef.current();
      set.delete(run);
    };
  }, [key, run]);

  return { data, error, loading: loading && data === undefined && !error, refetch: run };
}
