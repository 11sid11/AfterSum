import { type ReactNode } from 'react';
import clsx from 'clsx';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-4 py-11 text-center sm:py-14', className)}>
      {icon && (
        <div className="relative mb-5">
          <div className="absolute inset-1 rounded-full bg-brand-500/12 blur-xl" aria-hidden="true" />
          <div className="relative grid h-14 w-14 place-items-center rounded-[19px] border border-slate-900/[0.06] bg-white text-brand-600 shadow-soft-sm dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-brand-300 dark:shadow-none">
            {icon}
          </div>
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
