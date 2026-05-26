import type { ReactNode } from 'react';
import type { HideBelow } from '@proteticflow/shared';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  width?: string;
  sortable?: boolean;
  hideBelow?: HideBelow;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableSort {
  id: string;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string | number;
  empty?: { title: string; description?: string; cta?: ReactNode };
  loading?: boolean;
  loadingRows?: number;
  onRowClick?: (row: T) => void;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  density?: 'comfortable' | 'compact';
  className?: string;
}

export const HIDE_BELOW_CLASS: Record<HideBelow, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};
