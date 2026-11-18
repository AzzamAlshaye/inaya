import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Accessible modal built on the native <dialog> element (focus trap + Escape for free). */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-inner">
          <header className="dialog-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')}>
              <Icon name="close" />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmRequest {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const ConfirmContext = createContext<(message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>>(
  async () => false,
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback(
    (message: string, opts?: { confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setReq({ message, ...opts, resolve })),
    [],
  );

  const finish = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!req}
        title={t('appName')}
        onClose={() => finish(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => finish(false)}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className={`btn ${req?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => finish(true)}
            >
              {req?.confirmLabel ?? t('delete')}
            </button>
          </>
        }
      >
        <p className="confirm-message">{req?.message}</p>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
