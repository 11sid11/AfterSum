/**
 * DateInput — YYYY-MM-DD control.
 *
 * Wraps the native date input so the value is always
 * the canonical "YYYY-MM-DD" form. The native control
 * uses the user's locale calendar.
 */

import { useState, useEffect } from 'react';
import { todayDateOnly } from '@shared/dates';

interface DateInputProps {
  value: string | undefined;
  onChange: (date: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  max?: string;
  min?: string;
}

export function DateInput({ value, onChange, label = 'Date', hint, error, required, max, min }: DateInputProps) {
  const [v, setV] = useState<string>(value ?? todayDateOnly());
  useEffect(() => {
    if (value) setV(value);
  }, [value]);
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <input
        type="date"
        value={v}
        max={max}
        min={min}
        required={required}
        onChange={(e) => {
          setV(e.target.value);
          onChange(e.target.value);
        }}
        aria-label={label}
        aria-invalid={!!error}
        className="input h-11"
      />
      {(hint || error) && (
        <p className={`text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>{error ?? hint}</p>
      )}
    </div>
  );
}
