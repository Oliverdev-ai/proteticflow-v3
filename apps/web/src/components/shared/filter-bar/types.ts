import type { ReactNode } from 'react';

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}
