import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';

interface ToastOptions {
  action?: { label: string; onClick: () => void };
}
interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, options?: ToastOptions) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, ...options });
    timer.current = window.setTimeout(() => setToast(null), options?.action ? 8000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Live region is always rendered so screen readers announce new messages. */}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="btn btn-text toast-action"
                onClick={() => {
                  toast.action!.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="icon-btn toast-close" aria-label={t('close')} onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
