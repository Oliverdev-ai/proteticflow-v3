import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface FormSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  separator?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  icon,
  separator = true,
  className,
  children,
}: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-[0.875rem] font-semibold text-[var(--fg)]">{title}</h2>
          {description ? (
            <p className="text-[0.75rem] uppercase tracking-normal text-[var(--fg-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {separator ? <div className="h-px bg-[var(--border)]" /> : null}
      {children}
    </section>
  );
}
