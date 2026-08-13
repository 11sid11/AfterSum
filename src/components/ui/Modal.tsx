/** Modal — bottom sheet on mobile and centered card on larger screens. */

import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  lockScroll?: boolean;
}

export function Modal({ open, onClose, title, children, className, lockScroll = true }: ModalProps) {
  useEffect(() => {
    if (!open || !lockScroll) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open, lockScroll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={clsx(
          'max-h-[calc(100dvh-0.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/40 bg-white p-5 shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:p-6',
          className,
        )}
      >
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between bg-white/95 px-1 pb-1 backdrop-blur dark:bg-slate-900/95">
          <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-button"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
