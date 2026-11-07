import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Icon, type IconName } from './Icon';

/**
 * Every page opens the same way, answering "where am I?" (title), "what is this for?" (one line),
 * and "what can I do?" (the main buttons on the right).
 */
export function PageHeader({ title, description, actions, icon, back }: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  back?: { to: string; label: string };
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {back ? (
          <Link to={back.to} className="page-header__back">
            <Icon name="chevronLeft" size={16} /> {back.label}
          </Link>
        ) : null}
        <h1 className="page-header__title">
          {icon ? (
            <span className="page-header__icon" aria-hidden>
              <Icon name={icon} size={20} />
            </span>
          ) : null}
          {title}
        </h1>
        <div className="page-header__desc">{description}</div>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

/** A number that matters, with what it means underneath. */
export function StatTile({ label, value, hint, icon, tone = 'white', to, trend }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: 'white' | 'dark' | 'orange' | 'stone';
  to?: string;
  trend?: number | null;
}) {
  const body = (
    <>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {icon ? (
          <span className="stat__icon" aria-hidden>
            <Icon name={icon} size={17} />
          </span>
        ) : null}
      </div>
      <div className="stat__value">{value}</div>
      <div className="stat__bottom">
        {trend !== undefined && trend !== null ? (
          <span className={`trend ${trend >= 0 ? 'trend--up' : 'trend--down'}`}>
            <Icon name={trend >= 0 ? 'arrowUp' : 'arrowDown'} size={12} strokeWidth={2.4} />
            {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="stat__hint">{hint}</span> : null}
      </div>
    </>
  );
  if (to)
    return (
      <Link to={to} className={`stat stat--${tone} stat--link`}>
        {body}
      </Link>
    );
  return <div className={`stat stat--${tone}`}>{body}</div>;
}
