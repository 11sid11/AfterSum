/**
 * SplitAllocationEditor.
 *
 * Form for entering per-participant allocation values
 * (exact / percentage / shares). Equal split needs no
 * editor.
 *
 * Renders one row per participant with an inline number
 * input. Shows a live "total" indicator so the user knows
 * whether their inputs balance.
 *
 * This component is purely a value editor. It does NOT
 * compute or enforce invariants — the parent form runs the
 * pure functions in `domain/splits.ts` on submit and shows
 * a Zod error if totals don't match.
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { Person } from '@db/schema';
import { sumMinor, formatMoney, decimalToMinor } from '@shared/money';
import type { CurrencyCode } from '@shared/money';
import type { SplitMethod } from '@db/schema';

export interface SplitAllocationEditorProps {
  method: SplitMethod;
  participants: Person[];
  currency: CurrencyCode;
  totalAmountMinor: number;
  /** Per-person raw text values (so the user can keep typing). */
  values: Record<string, string>;
  onChange: (personId: string, raw: string) => void;
  disabled?: boolean;
  error?: string;
}

export function SplitAllocationEditor({
  method,
  participants,
  currency,
  totalAmountMinor,
  values,
  onChange,
  disabled,
  error,
}: SplitAllocationEditorProps) {
  const hint = useMemo(() => {
    switch (method) {
      case 'equal':
        return 'Equal split — no allocation needed.';
      case 'exact':
        return 'Enter the exact amount each person owes. Totals must equal the expense amount.';
      case 'percentage':
        return 'Enter a percentage for each person. Total must equal 100%.';
      case 'shares':
        return 'Enter an integer share for each person. Higher share = bigger portion.';
    }
  }, [method]);

  if (method === 'equal') {
    return <p className="text-xs text-slate-500">{hint}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{hint}</p>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {participants.map((p) => (
          <AllocationRow
            key={p.id}
            method={method}
            person={p}
            currency={currency}
            value={values[p.id] ?? ''}
            disabled={disabled}
            onChange={(raw) => onChange(p.id, raw)}
          />
        ))}
        {method === 'exact' && (
          <AllocationTotalRow
            currency={currency}
            values={values}
            target={totalAmountMinor}
          />
        )}
        {method === 'percentage' && (
          <AllocationPercentTotal values={values} />
        )}
      </ul>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface AllocationRowProps {
  method: SplitMethod;
  person: Person;
  currency: CurrencyCode;
  value: string;
  disabled?: boolean;
  onChange: (raw: string) => void;
}

function AllocationRow({ method, person, currency, value, disabled, onChange }: AllocationRowProps) {
  const symbol =
    method === 'exact' || method === 'shares' ? currency : method === 'percentage' ? '%' : '';
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex-1 text-sm">
        {person.name}
        {person.isSelf ? ' (me)' : ''}
      </span>
      <div className="relative w-32">
        {method === 'exact' && (
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-500">
            {currency}
          </span>
        )}
        {method === 'percentage' && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-slate-500">
            %
          </span>
        )}
        <input
          type="text"
          inputMode={method === 'shares' ? 'numeric' : 'decimal'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`${method} for ${person.name}`}
          className={clsx(
            'input h-9 w-full text-right tabular-nums',
            method === 'exact' && 'pl-10',
            method === 'percentage' && 'pr-7',
          )}
          placeholder={method === 'shares' ? '1' : '0'}
        />
      </div>
      {method === 'exact' && <span className="sr-only">{symbol}</span>}
    </li>
  );
}

function AllocationTotalRow({
  currency,
  values,
  target,
}: {
  currency: CurrencyCode;
  values: Record<string, string>;
  target: number;
}) {
  const computed = useMemo(() => {
    const arr: number[] = [];
    for (const v of Object.values(values)) {
      if (v.trim() === '') continue;
      try {
        arr.push(decimalToMinor(v, currency));
      } catch {
        // skip invalid intermediate states
      }
    }
    return arr;
  }, [values, currency]);
  const total = sumMinor(computed);
  const balanced = total === target;
  return (
    <li className="flex items-center gap-3 bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/40">
      <span className="flex-1 text-slate-500">Total</span>
      <span
        className={clsx(
          'w-32 text-right tabular-nums',
          balanced ? 'text-emerald-600' : 'text-amber-600',
        )}
      >
        {formatMoney({ amountMinor: total, currency })}
      </span>
    </li>
  );
}

function AllocationPercentTotal({ values }: { values: Record<string, string> }) {
  const total = useMemo(() => {
    let s = 0;
    for (const v of Object.values(values)) {
      const n = Number(v);
      if (Number.isFinite(n)) s += n;
    }
    return s;
  }, [values]);
  const balanced = Math.abs(total - 100) < 0.0001;
  return (
    <li className="flex items-center gap-3 bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/40">
      <span className="flex-1 text-slate-500">Total</span>
      <span
        className={clsx(
          'w-32 text-right tabular-nums',
          balanced ? 'text-emerald-600' : 'text-amber-600',
        )}
      >
        {total.toFixed(2)}%
      </span>
    </li>
  );
}
