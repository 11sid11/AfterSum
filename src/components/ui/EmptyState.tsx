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
    <div className={clsx('flex flex-col items-center justify-center gap-3 py-10 text-center', className)}>
      {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
