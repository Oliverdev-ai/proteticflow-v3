import { AlertCircle } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

export interface FormErrorProps extends HTMLAttributes<HTMLParagraphElement> {}

export const FormError = forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        role="alert"
        className={cn(
          'flex items-start gap-1.5 text-[0.8125rem] font-medium text-[var(--destructive)] animate-in fade-in duration-150',
          className,
        )}
        {...props}
      >
        <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden />
        <span>{children}</span>
      </p>
    );
  },
);

FormError.displayName = 'FormError';
