import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { Icon } from './Icon';

/**
 * A labelled form field: label on top, the control, then either a short hint or the error.
 * The control gets its id, aria-describedby and aria-invalid wired up automatically.
 */
export function Field({ label, hint, error, optional, children, className = '' }: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': hint || error ? hintId : undefined, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className={`field${error ? ' field--error' : ''} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="field__optional">Optional</span> : null}
      </label>
      {control}
      {error ? (
        <p className="field__error" id={hintId} role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ prefix, suffix, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  if (!prefix && !suffix) return <input className={`input ${className}`} {...rest} />;
  return (
    <div className={`input-group ${className}`}>
      {prefix ? <span className="input-group__affix">{prefix}</span> : null}
      <input className="input input--bare" {...rest} />
      {suffix ? <span className="input-group__affix">{suffix}</span> : null}
    </div>
  );
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input textarea ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`select ${className}`}>
      <select className="input select__control" {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={16} className="select__chevron" />
    </div>
  );
}

/** On/off switch with its meaning written next to it, so it never relies on colour alone. */
export function Switch({ checked, onChange, label, description, disabled, id: idProp }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const gen = useId();
  const id = idProp ?? gen;
  return (
    <label className={`switch-row${disabled ? ' switch-row--disabled' : ''}`} htmlFor={id}>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {description ? <span className="switch-row__desc">{description}</span> : null}
      </span>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" aria-hidden>
          <span className="switch__thumb" />
        </span>
      </span>
    </label>
  );
}

/** A compact switch for table rows; the label is read by screen readers. */
export function MiniSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch switch--mini" title={label} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden>
        <span className="switch__thumb" />
      </span>
    </label>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`checkbox${disabled ? ' checkbox--disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="checkbox__box" aria-hidden>
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
      <span className="checkbox__label">{label}</span>
    </label>
  );
}

/** − 3 + stepper for quantities. */
export function Stepper({ value, onChange, min = 0, max = 999, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Icon name="minus" size={14} />
      </button>
      <input
        className="stepper__value"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isNaN(n) ? min : Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

/** Two or more fields side by side on wide screens, stacked on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

/** A form-wide problem (e.g. "fix the 2 fields marked in red"). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="form-alert" role="alert">
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </div>
  );
}
