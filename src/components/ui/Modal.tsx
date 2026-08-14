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
      className="modal-backdrop fixed inset-0 z-40 flex items-end justify-center bg-[#090a0d]/55 backdrop-blur-[5px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          'modal-panel max-h-[calc(100dvh-0.35rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] border border-slate-900/[0.07] bg-[#fbfbfc] p-5 shadow-soft-lg dark:border-white/[0.08] dark:bg-[#111217] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px] sm:p-6',
          className,
        )}
      >
        <div className="sticky top-0 z-10 -mx-1 mb-5 flex items-center justify-between bg-[#fbfbfc]/94 px-1 pb-1 backdrop-blur-xl dark:bg-[#111217]/94">
          <h2 className="min-w-0 truncate text-[19px] font-semibold tracking-[-0.03em]">{title}</h2>
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
