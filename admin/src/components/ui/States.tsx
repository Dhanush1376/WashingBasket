import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** Soft pulsing block in the shape of the content that's on its way (as in the customer app). */
export function Skeleton({ height = 16, width = '100%', radius = 10, className = '' }: { height?: number; width?: number | string; radius?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ height, width, borderRadius: radius }} aria-hidden />;
}

export function SkeletonRows({ rows = 6, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={14} />
      ))}
    </div>
  );
}

/** Friendly empty state: an icon, why it's empty, and one way forward. */
export function EmptyState({ icon = 'inbox', title, message, action, compact }: {
  icon?: IconName;
  title: string;
  message: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty${compact ? ' empty--compact' : ''}`}>
      <span className="empty__icon">
        <Icon name={icon} size={compact ? 20 : 26} />
      </span>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__message">{message}</p>
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <span className="empty__icon empty__icon--danger">
        <Icon name="alert" size={26} />
      </span>
      <h3 className="empty__title">This didn’t load</h3>
      <p className="empty__message">{message ?? 'Something went wrong while loading. Please try again.'}</p>
      {onRetry ? (
        <div className="empty__action">
          <Button icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Catches a crash inside one page so the rest of the portal (sidebar, other pages) keeps working. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <ErrorState message="This page ran into a problem. Your other pages still work." onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
