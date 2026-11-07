import { useRef, type ReactNode } from 'react';

import { Icon } from './Icon';

/** Search box with a clear button. Typing filters straight away; there's no "go" button to find. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="search">
      <Icon name="search" size={18} className="search__icon" />
      <input
        ref={ref}
        type="search"
        className="search__input"
        value={value}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
        >
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export type FilterOption<V extends string> = { value: V; label: string; count?: number };

/** The customer app's pill filters: one row, the chosen one solid charcoal. Scrolls sideways on phones. */
export function FilterPills<V extends string>({ options, value, onChange, label }: { options: FilterOption<V>[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div className="pills" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`pill${o.value === value ? ' pill--on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined ? <span className="pill__count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** The bar above a list: filters on the left, search and actions on the right; stacks on phones. */
export function Toolbar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div className="toolbar">
      <div className="toolbar__start">{children}</div>
      {end ? <div className="toolbar__end">{end}</div> : null}
    </div>
  );
}

/** "3 of 34 orders match" + a reset link, shown when a search or filter narrows the list. */
export function ResultNote({ shown, total, noun, onReset }: { shown: number; total: number; noun: string; onReset?: () => void }) {
  if (shown === total) return null;
  return (
    <p className="result-note" role="status">
      {shown} of {total} {noun} match.
      {onReset ? (
        <button type="button" className="link-btn" onClick={onReset}>
          Clear filters
        </button>
      ) : null}
    </p>
  );
}
