import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--primary)] text-[var(--fg-on-primary)]',
    'hover:bg-[var(--primary-hover)]',
    'active:bg-[var(--primary-press)] active:shadow-[inset_0_1px_0_rgb(0_0_0/0.06)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
  ].join(' '),
  secondary: [
    'bg-[var(--bg-subtle)] text-[var(--fg)] border border-[var(--border)]',
    'hover:bg-[var(--bg-muted)] hover:border-[var(--border-strong)]',
    'active:bg-[var(--bg-subtle)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[var(--fg-muted)]',
    'hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
  ].join(' '),
  destructive: [
    'bg-[var(--destructive)] text-white',
    'hover:opacity-90',
    'active:opacity-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]',
  ].join(' '),
  outline: [
    'bg-transparent text-[var(--fg)] border border-[var(--border)]',
    'hover:border-[var(--primary)] hover:text-[var(--primary)]',
    'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-[0.8125rem] gap-1.5 rounded-[var(--radius-sm)]',
  md: 'h-9 px-4 text-[0.875rem] gap-2 rounded-[var(--radius-md)]',
  lg: 'h-11 px-6 text-[1rem] gap-2.5 rounded-[var(--radius-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap',
          'transition-all duration-[var(--dur-fast)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-0.5 size-4 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
