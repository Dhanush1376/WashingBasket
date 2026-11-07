import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Icon, type IconName } from './Icon';

/*
 * Pill buttons in the customer app's style: solid charcoal for the main action on a page (like
 * "Book now" and "Top Up"), brand orange for creating something new, white outline for the rest.
 */
export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'outline', size = 'md', icon, iconRight, loading, block, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children ? <span>{children}</span> : null}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} /> : null}
    </button>
  );
});

/** A link styled as a button, for actions that open another page. */
export function ButtonLink({ to, variant = 'outline', size = 'md', icon, iconRight, children }: { to: string; variant?: ButtonVariant; size?: ButtonSize; icon?: IconName; iconRight?: IconName; children: ReactNode }) {
  return (
    <Link to={to} className={`btn btn--${variant} btn--${size}`}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      <span>{children}</span>
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} /> : null}
    </Link>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  /** Always required: read by screen readers and shown as a tooltip. */
  label: string;
  tone?: 'plain' | 'outline' | 'dark' | 'danger';
  size?: number;
  badge?: number;
};

/** The customer app's round icon button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, tone = 'plain', size = 40, badge, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`icon-btn icon-btn--${tone} ${className}`}
      style={{ width: size, height: size }}
      aria-label={badge ? `${label}, ${badge} waiting` : label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} />
      {badge ? <span className="icon-btn__badge">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
});
