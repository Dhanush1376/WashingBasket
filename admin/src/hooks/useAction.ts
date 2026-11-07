import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { refreshAll } from '@/lib/query';

/**
 * Runs a change (save, delete, status update), shows a toast with the result, and refreshes every
 * list on screen so all pages agree. `busy` is true while it runs, for button spinners.
 */
export function useAction() {
  const { show } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(id: string, task: () => Promise<T>, success: string | ((r: T) => string), detail?: string): Promise<T | undefined> => {
      setBusy(id);
      try {
        const result = await task();
        refreshAll();
        show('success', typeof success === 'function' ? success(result) : success, detail);
        return result;
      } catch (e) {
        show('error', 'That didn’t work', e instanceof Error ? e.message : 'Please try again.');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [show],
  );

  return { run, busy, isBusy: (id: string) => busy === id };
}
