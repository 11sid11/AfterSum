/**
 * Simple toast + undo hook.
 *
 * Used after destructive operations (delete, settle) to give
 * the user a chance to undo within a short window.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { UNDO_TIMEOUT_MS } from '@app/constants';

type ToastVariant = 'default' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration: number;
}

interface ToastContextValue {
  show: (msg: string, opts?: { variant?: ToastVariant; action?: Toast['action']; duration?: number }) => void;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, opts) => {
    const id = nextId++;
    const toast: Toast = {
      id,
      message,
      variant: opts?.variant ?? 'default',
      action: opts?.action,
      duration: opts?.duration ?? (opts?.action ? UNDO_TIMEOUT_MS : 3000),
    };
    setToasts((cur) => [...cur, toast]);
    setTimeout(() => dismiss(id), toast.duration);
  }, [dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            role="status"
          >
            <span className="flex-1 text-sm">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
