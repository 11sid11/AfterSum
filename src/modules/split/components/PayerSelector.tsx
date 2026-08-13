/**
 * Single-payer selector for Split V1.
 *
 * The expense total is entered once by the parent form. A single
 * payer is assumed to have paid that full amount, so this control
 * only asks who paid.
 */

import { PersonPicker } from '@components/ui';
import type { CurrencyCode } from '@shared/money';

export interface PayerSelectorProps {
  payerId: string | undefined;
  amountMinor: number;
  currency: CurrencyCode;
  onPayerChange: (id: string | undefined) => void;
  onAmountChange: (amountMinor: number) => void;
  error?: string;
}

export function PayerSelector({ payerId, onPayerChange, error }: PayerSelectorProps) {
  return (
    <PersonPicker
      value={payerId}
      onChange={onPayerChange}
      label="Paid by"
      excludeSelf={false}
      error={error}
    />
  );
}
