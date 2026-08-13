/** Toggle / switch. */

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
        'relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full border transition-all duration-150',
        checked
          ? 'border-brand-600 bg-brand-600 shadow-sm shadow-brand-600/20'
          : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={clsx(
          'inline-block h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </label>
  );
}
