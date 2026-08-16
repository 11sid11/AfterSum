import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'ghost' | 'danger' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const base =
  'relative inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.975]';

const variantClass: Record<Variant, string> = {
  primary:
    'border border-brand-600 bg-brand-600 text-white shadow-[0_1px_2px_rgb(48_36_140/0.12),0_5px_14px_rgb(98_77_223/0.16)] hover:-translate-y-px hover:bg-brand-700 hover:shadow-[0_8px_20px_rgb(98_77_223/0.2)] dark:border-brand-400 dark:bg-brand-400 dark:text-brand-950 dark:hover:bg-brand-300',
  secondary:
    'border border-slate-200 bg-white text-slate-800 shadow-[0_1px_2px_rgb(15_23_42/0.035)] hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.09] dark:bg-white/[0.055] dark:text-slate-100 dark:hover:bg-white/[0.085]',
  ghost:
    'border border-transparent text-slate-600 hover:bg-slate-900/[0.045] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white',
  danger:
    'border border-rose-600 bg-rose-600 text-white shadow-[0_5px_14px_rgb(225_29_72/0.14)] hover:-translate-y-px hover:bg-rose-700',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-10 rounded-xl px-3 text-xs',
  md: 'h-11 rounded-[14px] px-4 text-sm',
  lg: 'h-12 rounded-[15px] px-5 text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        base,
        variantClass[variant],
        sizeClass[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
});
