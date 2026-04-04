import React from 'react';
import { cn } from '@/lib/utils';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
}

export function H1({ children, className, as: Component = 'h1' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function H2({ children, className, as: Component = 'h2' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function H3({ children, className, as: Component = 'h3' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-xl font-semibold tracking-tight text-foreground",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function Subtitle({ children, className, as: Component = 'p' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-lg text-muted-foreground",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function Muted({ children, className, as: Component = 'p' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-sm text-muted-foreground/80 font-medium",
        className
      )}
    >
      {children}
    </Component>
  );
}

export function Large({ children, className, as: Component = 'div' }: TypographyProps) {
  return (
    <Component
      className={cn(
        "text-lg font-semibold text-foreground",
        className
      )}
    >
      {children}
    </Component>
  );
}
