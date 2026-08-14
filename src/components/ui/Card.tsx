import { type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

const surfaceClass =
  'rounded-[18px] border border-slate-200/[0.85] bg-white shadow-[0_1px_2px_rgb(15_23_42/0.025),0_5px_16px_rgb(15_23_42/0.035)] dark:border-white/[0.075] dark:bg-[#141821] dark:shadow-none';

export function Card({ children, className, padded = true, ...rest }: CardProps) {
  return (
    <div
      className={clsx(surfaceClass, padded && 'p-4 sm:p-5', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-3.5 flex items-center justify-between gap-3', className)}>{children}</div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('text-[15px] font-semibold tracking-[-0.02em]', className)}>{children}</h2>;
}
