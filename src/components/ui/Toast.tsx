/** Compact app feedback with optional undo action. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
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
    setToasts((cur) => cur.filter((toast) => toast.id !== id));
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
    window.setTimeout(() => dismiss(id), toast.duration);
  }, [dismiss]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-5">
        {toasts.map((toast) => {
          const Icon = toast.variant === 'success' ? CircleCheck : toast.variant === 'error' ? CircleAlert : Info;
          const iconClass = toast.variant === 'success'
            ? 'bg-emerald-400/15 text-emerald-300'
            : toast.variant === 'error'
              ? 'bg-rose-400/15 text-rose-300'
              : 'bg-white/[0.08] text-white/70';
          return (
            <div
              key={toast.id}
              className="toast-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[18px] border border-white/10 bg-[#17171d]/95 px-3.5 py-3 text-white shadow-soft-lg backdrop-blur-xl"
              role="status"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${iconClass}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-white/90">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="min-h-9 shrink-0 rounded-xl px-2.5 text-xs font-semibold text-brand-200 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
