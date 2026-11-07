import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';

/*
 * Modal dialogs and side drawers share one overlay: it traps focus, closes on Escape or a click
 * outside, locks page scrolling, and gives focus back to whatever opened it.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    openCount += 1;
    document.body.classList.add('no-scroll');
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el) return;
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
      target.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      const el = panel.current;
      if (!el) return;
      // only the top-most overlay reacts
      const layers = document.querySelectorAll('[data-overlay-panel]');
      if (layers[layers.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      openCount -= 1;
      if (openCount <= 0) document.body.classList.remove('no-scroll');
      opener?.focus?.();
    };
  }, [open, panel]);
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

/** Centered dialog on desktop; slides up as a bottom sheet on phones. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="overlay overlay--center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} data-overlay-panel className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="modal__desc">{description}</p> : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} size={36} />
        </header>
        {children ? <div className="modal__body">{children}</div> : null}
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Ask before anything that can't be undone, in plain words: what happens, and the button says it again. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, tone = 'danger', loading, icon = 'alert', children }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  icon?: IconName;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep it
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={`confirm confirm--${tone}`}>
        <span className="confirm__icon">
          <Icon name={icon} size={22} />
        </span>
        <div className="confirm__text">{message}</div>
      </div>
      {children}
    </Modal>
  );
}

/** Slides in from the right on desktop and tablet; full screen on phones. */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560, headerExtra }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  headerExtra?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="overlay overlay--side" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} data-overlay-panel className="drawer" style={{ ['--drawer-w' as string]: `${width}px` }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="drawer__header">
          <IconButton icon="x" label="Close" onClick={onClose} size={38} tone="outline" />
          <div className="drawer__titles">
            <h2 className="drawer__title" id={titleId}>
              {title}
            </h2>
            {subtitle ? <div className="drawer__subtitle">{subtitle}</div> : null}
          </div>
          {headerExtra}
        </header>
        <div className="drawer__body">{children}</div>
        {footer ? <footer className="drawer__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
