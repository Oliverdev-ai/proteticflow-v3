import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leadingIcon, trailingIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[var(--fs-13)] font-medium text-[var(--fg)] leading-none"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] size-4 flex items-center">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)]',
              'px-3 py-2 text-[0.875rem] font-[var(--font-sans)] text-[var(--fg)]',
              'placeholder:text-[var(--fg-subtle)]',
              'transition-[border-color,box-shadow] duration-[var(--dur-fast)]',
              'focus-visible:outline-none focus-visible:border-[var(--border-focus)] focus-visible:shadow-[var(--shadow-focus)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--destructive)] focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_rgb(178_58_51/0.4)]',
              leadingIcon && 'pl-9',
              trailingIcon && 'pr-9',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] size-4 flex items-center">
              {trailingIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-[0.8125rem] text-[var(--destructive)]">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-[0.8125rem] text-[var(--fg-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
