/**
 * PayerSelector.
 *
 * V1 supports a single payer per expense. The UI uses
 * `PersonPicker` plus a money input. The model already
 * supports multiple payers, so this can be extended
 * later without schema changes.
 */

import { PersonPicker, MoneyInput } from '@components/ui';
import type { CurrencyCode } from '@shared/money';

export interface PayerSelectorProps {
  payerId: string | undefined;
  amountMinor: number;
  currency: CurrencyCode;
  onPayerChange: (id: string | undefined) => void;
  onAmountChange: (amountMinor: number) => void;
  error?: string;
}

export function PayerSelector({
  payerId,
  amountMinor,
  currency,
  onPayerChange,
  onAmountChange,
  error,
}: PayerSelectorProps) {
  return (
    <div className="space-y-2">
      <PersonPicker
        value={payerId}
        onChange={onPayerChange}
        label="Paid by"
        excludeSelf={false}
      />
      <MoneyInput
        value={amountMinor}
        currency={currency}
        onChange={onAmountChange}
        label="Amount paid"
        error={error}
      />
    </div>
  );
}
