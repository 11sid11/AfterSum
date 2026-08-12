import { type ReactNode } from 'react';
import clsx from 'clsx';

interface BalanceTextProps {
  amountMinor: number;
  children: ReactNode;
  className?: string;
}

/**
 * Renders a positive/negative/zero balance label using
 * text (not color alone) so it's accessible.
 */
export function BalanceText({ amountMinor, children, className }: BalanceTextProps) {
  const label = amountMinor > 0 ? 'Owes you' : amountMinor < 0 ? 'You owe' : 'Settled';
  return (
    <span className={clsx('inline-flex items-center gap-1', className)}>
      <span className="text-slate-500">{label}</span>
      <strong>{children}</strong>
    </span>
  );
}
