import {
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../../../lib/utils';
import { FormError } from './form-error';
import { FormHint } from './form-hint';
import { FormLabel } from './form-label';

type FormControlProps = {
  id?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean | 'true' | 'false' | undefined;
  'aria-describedby'?: string | undefined;
};

export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
}

function mergeAriaDescribedBy(...values: Array<string | undefined>) {
  const merged = values
    .flatMap((value) => (value ? value.split(' ') : []))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return merged.length > 0 ? Array.from(new Set(merged)).join(' ') : undefined;
}

function buildIdFromLabel(label: string, suffix: string) {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${normalized || 'field'}-${suffix}`;
}

export function FormField({
  label,
  hint,
  error,
  required = false,
  children,
  className,
  ...props
}: FormFieldProps) {
  const generatedSuffix = useId().replace(/:/g, '');
  const isControl = isValidElement(children);
  const childProps = (isControl ? (children.props as FormControlProps) : undefined) ?? {};
  const controlId = childProps.id ?? buildIdFromLabel(label, generatedSuffix);
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = mergeAriaDescribedBy(childProps['aria-describedby'], error ? errorId : hintId);

  const control = isControl
    ? cloneElement(children as ReactElement<FormControlProps>, {
        id: controlId,
        ...(error ? { 'aria-invalid': 'true' as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      <FormLabel htmlFor={isControl ? controlId : undefined} required={required}>
        {label}
      </FormLabel>
      {control}
      {error ? <FormError id={errorId}>{error}</FormError> : null}
      {!error && hint ? <FormHint id={hintId}>{hint}</FormHint> : null}
    </div>
  );
}
