import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'ghost' | 'danger' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary:
    'btn border border-slate-900/[0.07] bg-white/90 text-slate-800 shadow-soft-xs hover:-translate-y-px hover:border-slate-900/[0.1] hover:bg-white hover:shadow-soft-sm dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-slate-100 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:shadow-none',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 rounded-[13px] px-3 text-xs',
  md: 'h-11 rounded-2xl px-4 text-sm',
  lg: 'h-12 rounded-[18px] px-5 text-[15px]',
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
        variantClass[variant],
        sizeClass[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
});
