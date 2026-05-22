import type { ReactNode } from 'react';

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}
