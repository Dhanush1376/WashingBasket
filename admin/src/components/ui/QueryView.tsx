import type { ReactNode } from 'react';

import type { Query } from '@/lib/query';
import { ErrorState, SkeletonRows } from './States';

/** Shows the loading skeleton, the error with "Try again", or the content: one place for all three. */
export function QueryView<T>({ query, children, skeleton }: { query: Query<T>; children: (data: T) => ReactNode; skeleton?: ReactNode }) {
  if (query.error) return <ErrorState message={query.error.message} onRetry={query.refetch} />;
  if (query.data === undefined) return <>{skeleton ?? <SkeletonRows />}</>;
  return <>{children(query.data)}</>;
}
