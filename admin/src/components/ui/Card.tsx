import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

/** White rounded surface on the warm canvas, as on the customer app's Home. */
export function Card({ children, className = '', padded = true, tone = 'white', as: Tag = 'section', ...rest }: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  tone?: 'white' | 'stone' | 'dark' | 'orange';
  as?: 'section' | 'div' | 'article';
  'aria-labelledby'?: string;
}) {
  return (
    <Tag className={`card card--${tone}${padded ? ' card--padded' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** A card's title row: what this card is, a hint, and an optional action on the right. */
export function CardHeader({ title, hint, icon, action, id }: { title: string; hint?: ReactNode; icon?: IconName; action?: ReactNode; id?: string }) {
  return (
    <header className="card-header">
      <div className="card-header__text">
        <h2 className="card-header__title" id={id}>
          {icon ? (
            <span className="card-header__icon">
              <Icon name={icon} size={16} />
            </span>
          ) : null}
          {title}
        </h2>
        {hint ? <p className="card-header__hint">{hint}</p> : null}
      </div>
      {action ? <div className="card-header__action">{action}</div> : null}
    </header>
  );
}

/** A label above a value, in a row or grid of facts. */
export function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`fact${wide ? ' fact--wide' : ''}`}>
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{children}</dd>
    </div>
  );
}

export function Facts({ children }: { children: ReactNode }) {
  return <dl className="facts">{children}</dl>;
}
