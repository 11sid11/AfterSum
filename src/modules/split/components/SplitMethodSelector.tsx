/**
 * SplitMethodSelector.
 *
 * A four-button toggle for picking the expense split method.
 * The "method" string is the source of truth — the parent
 * form is responsible for switching the allocation editor.
 */

import clsx from 'clsx';
import type { SplitMethod } from '@db/schema';

interface SplitMethodSelectorProps {
  value: SplitMethod;
  onChange: (next: SplitMethod) => void;
  disabled?: boolean;
  id?: string;
}

const METHODS: Array<{ value: SplitMethod; label: string; hint: string }> = [
  { value: 'equal', label: 'Equal', hint: 'Split evenly' },
  { value: 'exact', label: 'Exact', hint: 'Enter exact amounts' },
  { value: 'percentage', label: 'Percent', hint: 'By percent' },
  { value: 'shares', label: 'Shares', hint: 'By weight' },
];

export function SplitMethodSelector({ value, onChange, disabled, id }: SplitMethodSelectorProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Split method"
      className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/40"
    >
      {METHODS.map((m) => {
        const active = m.value === value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={clsx(
              'rounded-lg px-2 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
            )}
            title={m.hint}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
