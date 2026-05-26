import type { HTMLAttributes } from 'react';
import type { StatusChipVariant } from '@proteticflow/shared';
import { cn } from '../../lib/utils';

const STATUS_CHIP_VARIANT_CLASS: Record<StatusChipVariant, string> = {
  neutral: 'chip-neutral',
  info: 'chip-info',
  warning: 'chip-warning',
  success: 'chip-success',
  accent: 'chip-accent',
  primary: 'chip-primary',
  destructive: 'chip-destructive',
};

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  variant: StatusChipVariant;
}

export function StatusChip({ label, variant, className, ...props }: StatusChipProps) {
  return (
    <span
      className={cn('chip', STATUS_CHIP_VARIANT_CLASS[variant], className)}
      {...props}
    >
      {label}
    </span>
  );
}
