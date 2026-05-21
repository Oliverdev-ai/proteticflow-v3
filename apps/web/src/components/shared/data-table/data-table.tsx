import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { EmptyRow } from './empty-row';
import { SkeletonRow } from './skeleton-row';
import { HIDE_BELOW_CLASS, type Column, type DataTableProps, type DataTableSort } from './types';

function getSortIcon(columnId: string, sort?: DataTableSort) {
  if (!sort || sort.id !== columnId) {
    return null;
  }

  if (sort.dir === 'asc') {
    return <ChevronUp className="size-4" aria-hidden="true" />;
  }

  return <ChevronDown className="size-4" aria-hidden="true" />;
}

function getAlignClass<T>(column: Column<T>): string {
  if (column.align === 'center') return 'text-center';
  if (column.align === 'right') return 'text-right';
  return 'text-left';
}

function getWidthStyle<T>(column: Column<T>): { width?: string } {
  if (!column.width || column.width === 'flex') {
    return {};
  }

  return { width: column.width };
}

export function getNextSort(currentSort: DataTableSort | undefined, columnId: string): DataTableSort {
  if (!currentSort || currentSort.id !== columnId) {
    return { id: columnId, dir: 'asc' };
  }

  return { id: columnId, dir: currentSort.dir === 'asc' ? 'desc' : 'asc' };
}

export function runRowClickByKey<T>(
  event: Pick<KeyboardEvent<HTMLTableRowElement>, 'key' | 'preventDefault'>,
  row: T,
  onRowClick?: (value: T) => void,
) {
  if (!onRowClick || event.key !== 'Enter') {
    return;
  }

  event.preventDefault();
  onRowClick(row);
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty,
  loading = false,
  loadingRows = 6,
  onRowClick,
  sort,
  onSortChange,
  density = 'comfortable',
  className,
}: DataTableProps<T>) {
  const hasSortableColumn = columns.some((column) => column.sortable);
  if (hasSortableColumn && (!sort || !onSortChange)) {
    throw new Error('DataTable: sortable columns require controlled sort + onSortChange.');
  }

  const cellPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const emptyState = empty ?? { title: 'Nenhum registro' };
  const headerPadding = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={cn('overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)]', className)}>
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr>
            {columns.map((column) => {
              const alignClass = getAlignClass(column);
              const hideClass = column.hideBelow ? HIDE_BELOW_CLASS[column.hideBelow] : undefined;
              const widthStyle = getWidthStyle(column);

              return (
                <th
                  key={column.id}
                  style={widthStyle}
                  className={cn(
                    't-overline sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-elevated)]',
                    headerPadding,
                    alignClass,
                    hideClass,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors duration-[var(--dur-fast)]',
                        alignClass === 'text-right' && 'ml-auto',
                        alignClass === 'text-center' && 'mx-auto',
                        'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                      )}
                      onClick={() => onSortChange?.(getNextSort(sort, column.id))}
                    >
                      <span>{column.header}</span>
                      {getSortIcon(column.id, sort)}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }).map((_, index) => (
              <SkeletonRow key={`skeleton-${index}`} columns={columns} density={density} />
            ))
          ) : rows.length === 0 ? (
            <EmptyRow
              colSpan={columns.length}
              title={emptyState.title}
              {...(emptyState.description ? { description: emptyState.description } : {})}
              {...(emptyState.cta ? { cta: emptyState.cta } : {})}
            />
          ) : (
            rows.map((row) => (
              <tr
                key={getKey(row)}
                className={cn(
                  'border-b border-[var(--border)] last:border-b-0',
                  onRowClick ? 'cursor-pointer hover:bg-[var(--bg-muted)] focus-visible:bg-[var(--bg-muted)] focus-visible:outline-none' : undefined,
                )}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => runRowClickByKey(event, row, onRowClick) : undefined}
              >
                {columns.map((column) => {
                  const alignClass = getAlignClass(column);
                  const hideClass = column.hideBelow ? HIDE_BELOW_CLASS[column.hideBelow] : undefined;

                  return (
                    <td
                      key={column.id}
                      style={getWidthStyle(column)}
                      className={cn(cellPadding, alignClass, hideClass)}
                    >
                      {column.cell(row)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
