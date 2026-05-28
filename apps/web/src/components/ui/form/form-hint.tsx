import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

export interface FormHintProps extends HTMLAttributes<HTMLParagraphElement> {}

export const FormHint = forwardRef<HTMLParagraphElement, FormHintProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-[0.8125rem] font-normal text-[var(--fg-muted)]', className)}
        {...props}
      />
    );
  },
);

FormHint.displayName = 'FormHint';
