import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
