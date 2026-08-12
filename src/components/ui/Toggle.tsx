/**
 * Toggle / switch.
 */

import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={clsx(
        'inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
        disabled && 'opacity-50',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </label>
  );
}
