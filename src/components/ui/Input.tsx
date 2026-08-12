import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx('input', error && 'border-red-500 focus:border-red-500', className)}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {(hint || error) && (
        <p
          id={`${inputId}-desc`}
          className={clsx('text-xs', error ? 'text-red-600' : 'text-slate-500')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={clsx('input min-h-[80px] resize-y', error && 'border-red-500', className)}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {(hint || error) && (
        <p
          id={`${inputId}-desc`}
          className={clsx('text-xs', error ? 'text-red-600' : 'text-slate-500')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
