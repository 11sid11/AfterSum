/**
 * MoneyInput — typed money entry control.
 *
 * Stores value as minor units (integer) but displays a
 * human-friendly decimal in the user's currency.
 */

import { useState, useEffect } from 'react';
import { decimalToMinor, formatMoney, parseMoney } from '@shared/money';
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
  const [text, setText] = useState<string>(value !== undefined ? formatMoney({ amountMinor: value, currency }) : '');

  // When the external value changes (e.g. from a previous form
  // submission), update the displayed text.
  useEffect(() => {
    if (value === undefined) return;
    const expected = formatMoney({ amountMinor: value, currency });
    // Only update if the user isn't currently typing — i.e. the
    // current text doesn't parse to a different value than
    // the prop.
    if (text === '') {
      setText(expected);
    }
  }, [value, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setText(v);
    if (v.trim() === '') {
      onChange(0);
      return;
    }
    try {
      const parsed = parseMoney(v, currency);
      onChange(parsed.amountMinor);
    } catch {
      // Allow intermediate states like "12." while typing.
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

/** Helper to convert a user-entered string to minor units. */
export function stringToMinor(text: string, currency: CurrencyCode): number {
  return decimalToMinor(text, currency);
}

/** Helper to make a `Money` value from minor units. */
export function makeMoney(amountMinor: number, currency: CurrencyCode): Money {
  return { amountMinor, currency };
}
