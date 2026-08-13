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
    <div className={clsx('flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12', className)}>
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
