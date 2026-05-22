import { cn } from '../../../lib/utils';
import { Skeleton } from '../../ui/skeleton';
import { HIDE_BELOW_CLASS, type Column } from './types';

export interface SkeletonRowProps<T> {
  columns: Column<T>[];
  density: 'comfortable' | 'compact';
}

export function SkeletonRow<T>({ columns, density }: SkeletonRowProps<T>) {
  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0">
      {columns.map((column) => (
        <td
          key={column.id}
          className={cn(cellPadding, column.hideBelow ? HIDE_BELOW_CLASS[column.hideBelow] : undefined)}
        >
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
