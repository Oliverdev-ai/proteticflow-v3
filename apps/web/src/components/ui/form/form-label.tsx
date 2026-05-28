import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ required = false, className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'block text-[var(--fs-13)] font-medium text-[var(--fg)] leading-none',
          className,
        )}
        {...props}
      >
        {children}
        {required ? (
          <span className="ml-1 text-[var(--destructive)]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
    );
  },
);

FormLabel.displayName = 'FormLabel';
