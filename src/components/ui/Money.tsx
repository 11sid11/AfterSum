/**
 * Money display component.
 *
 * Renders a Money value, with optional privacy mode that
 * masks the digits. Currency symbol/format is computed
 * from `Intl.NumberFormat`.
 */

import { formatMoney } from '@shared/money';
import type { Money as MoneyValue } from '@shared/money';

interface MoneyProps {
  value: MoneyValue;
  className?: string;
  hide?: boolean;
  signed?: boolean;
  emphasize?: boolean;
}

export function Money({ value, className, hide, signed, emphasize }: MoneyProps) {
  if (hide) {
    return (
      <span className={className} aria-label="Amount hidden">
        ••••••
      </span>
    );
  }
  const formatted = formatMoney(value);
  const isPositive = value.amountMinor > 0;
  const isNegative = value.amountMinor < 0;
  return (
    <span
      className={className}
      data-positive={isPositive || undefined}
      data-negative={isNegative || undefined}
    >
      {emphasize ? <strong>{formatted}</strong> : formatted}
      {signed && isPositive ? ' ' : null}
    </span>
  );
}

interface MoneySignProps {
  amountMinor: number;
  currency: string;
  hide?: boolean;
}

export function MoneySigned({ amountMinor, currency, hide }: MoneySignProps) {
  if (hide) return <span aria-label="Amount hidden">••••••</span>;
  return (
    <span className={amountMinor > 0 ? 'text-emerald-600' : amountMinor < 0 ? 'text-rose-600' : 'text-slate-500'}>
      {amountMinor > 0 ? '+' : amountMinor < 0 ? '−' : ''}
      {formatMoney({ amountMinor: Math.abs(amountMinor), currency })}
    </span>
  );
}
