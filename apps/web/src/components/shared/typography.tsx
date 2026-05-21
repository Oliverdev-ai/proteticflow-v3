import React from 'react';
import { cn } from '../../lib/utils';

interface TypographyProps {
  children: React.ReactNode;
  className?: string | undefined;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div' | undefined;
}

type PageTitleProps = Omit<TypographyProps, 'as'> & {
  as?: 'h1' | 'h2';
};

export function PageTitle({ children, className, as: Component = 'h1' }: PageTitleProps) {
  return (
    <Component
      className={cn(
        'font-[var(--font-display)] text-[length:var(--fs-36)] leading-[var(--lh-36)] font-normal tracking-[var(--tracking-tight)] text-fg-strong text-balance sm:text-[length:var(--fs-48)] sm:leading-[var(--lh-48)]',
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function H1({ children, className, as: Component = 'h1' }: TypographyProps) {
  return (
    <PageTitle as={Component === 'h2' ? 'h2' : 'h1'} className={className}>
      {children}
    </PageTitle>
  );
}

export function H2({ children, className, as: Component = 'h2' }: TypographyProps) {
  return (
    <Component
      className={cn('text-2xl font-semibold tracking-tight text-foreground sm:text-3xl', className)}
    >
      {children}
    </Component>
  );
}

export function H3({ children, className, as: Component = 'h3' }: TypographyProps) {
  return (
    <Component className={cn('text-xl font-semibold tracking-tight text-foreground', className)}>
      {children}
    </Component>
  );
}

export function Subtitle({ children, className, as: Component = 'p' }: TypographyProps) {
  return (
    <Component className={cn('text-lg text-muted-foreground', className)}>{children}</Component>
  );
}

export function Muted({ children, className, as: Component = 'p' }: TypographyProps) {
  return (
    <Component className={cn('text-sm text-muted-foreground/80 font-medium', className)}>
      {children}
    </Component>
  );
}

export function Large({ children, className, as: Component = 'div' }: TypographyProps) {
  return (
    <Component className={cn('text-lg font-semibold text-foreground', className)}>
      {children}
    </Component>
  );
}
