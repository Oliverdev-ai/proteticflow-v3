import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:     'bg-[var(--bg-subtle)] text-[var(--fg-muted)] border border-[var(--border)]',
  primary:     'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20',
  success:     'bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20',
  warning:     'bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/20',
  destructive: 'bg-[var(--destructive-soft)] text-[var(--destructive)] border border-[var(--destructive)]/20',
  info:        'bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info)]/20',
  outline:     'bg-transparent text-[var(--fg-muted)] border border-[var(--border-strong)]',
};

const dotColors: Record<BadgeVariant, string> = {
  default:     'bg-[var(--fg-subtle)]',
  primary:     'bg-[var(--primary)]',
  success:     'bg-[var(--success)]',
  warning:     'bg-[var(--warning)]',
  destructive: 'bg-[var(--destructive)]',
  info:        'bg-[var(--info)]',
  outline:     'bg-[var(--fg-muted)]',
};

export function Badge({ variant = 'default', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-pill)]',
        'text-[0.6875rem] font-semibold tracking-normal uppercase whitespace-nowrap',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn('size-1.5 rounded-full shrink-0', dotColors[variant])} aria-hidden />
      )}
      {children}
    </span>
  );
}
