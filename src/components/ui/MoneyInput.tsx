/**
 * MoneyInput — typed money entry control.
 *
 * Stores value as integer minor units while keeping the editable
 * text as a plain decimal. The currency symbol is rendered once,
 * outside the text value, and programmatic value changes are
 * always reflected in the field.
 */

import { useEffect, useRef, useState } from 'react';
import { decimalToMinor, minorToDecimal, parseMoney } from '@shared/money';
import type { CurrencyCode, Money } from '@shared/money';
import { CURRENCY_OPTIONS } from '@app/constants';

interface MoneyInputProps {
  value: number | undefined;
  currency: CurrencyCode;
  onChange: (amountMinor: number) => void;
  label?: string;
  hint?: string;
  error?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

function editableValue(value: number | undefined, currency: CurrencyCode): string {
  if (value === undefined) return '';
  const decimal = minorToDecimal(value, currency);
  if (value === 0) return '';
  return String(decimal);
}

export function MoneyInput({
  value,
  currency,
  onChange,
  label = 'Amount',
  hint,
  error,
  autoFocus,
  placeholder = '0.00',
}: MoneyInputProps) {
  const symbol = CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol ?? currency;
  const [text, setText] = useState(() => editableValue(value, currency));
  const lastExternal = useRef(`${currency}:${value ?? ''}`);

  useEffect(() => {
    const nextKey = `${currency}:${value ?? ''}`;
    if (nextKey === lastExternal.current) return;
    lastExternal.current = nextKey;
    setText(editableValue(value, currency));
  }, [value, currency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    setText(nextText);
    if (nextText.trim() === '') {
      lastExternal.current = `${currency}:0`;
      onChange(0);
      return;
    }
    try {
      const parsed = parseMoney(nextText, currency);
      lastExternal.current = `${currency}:${parsed.amountMinor}`;
      onChange(parsed.amountMinor);
    } catch {
      // Intermediate values such as "12." remain editable.
    }
  };

  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          aria-label={label}
          aria-invalid={!!error}
          className="input h-12 pl-10 text-base font-semibold tracking-wide"
        />
      </div>
      {(hint || error) && (
        <p className={`text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function stringToMinor(text: string, currency: CurrencyCode): number {
  return decimalToMinor(text, currency);
}

export function makeMoney(amountMinor: number, currency: CurrencyCode): Money {
  return { amountMinor, currency };
}
