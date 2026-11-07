import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { Icon } from './Icon';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; title: string; detail?: string };

type Ctx = { show: (tone: ToastTone, title: string, detail?: string) => void };
const ToastContext = createContext<Ctx>({ show: () => {} });

/** Short confirmations in the corner ("Offer saved"), read out by screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, tone, title, detail }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span className="toast__icon">
              <Icon name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'alert' : 'info'} size={16} strokeWidth={2.2} />
            </span>
            <div className="toast__text">
              <strong>{t.title}</strong>
              {t.detail ? <span>{t.detail}</span> : null}
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
