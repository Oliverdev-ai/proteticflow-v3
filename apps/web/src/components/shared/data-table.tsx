import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ColumnDef<T> = {
  id?: string;
  header: ReactNode;
  accessor?: keyof T | ((row: T) => ReactNode);
  cell?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  numeric?: boolean;
  hideOnMobile?: boolean;
};

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  density?: 'compact' | 'comfortable';
  onDensityChange?: (d: 'compact' | 'comfortable') => void;
  pagination?: { page: number; pageSize: number; total: number; onChange: (p: number) => void };
};

function getCellValue<T>(column: ColumnDef<T>, row: T): ReactNode {
  if (column.cell) return column.cell(row);
  if (typeof column.accessor === 'function') return column.accessor(row);
  if (column.accessor) return row[column.accessor] as ReactNode;
  return null;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-4 py-3">
              <div className="h-4 w-full animate-pulse rounded-pill bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  emptyAction,
  density = 'comfortable',
  onDensityChange,
  pagination,
}: DataTableProps<T>) {
  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-3';
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className="space-y-3">
      {onDensityChange && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-md border border-border bg-card p-1">
            {(['comfortable', 'compact'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-sm px-3 py-1 text-xs font-medium text-muted-foreground transition-colors',
                  density === option && 'bg-muted text-foreground',
                )}
                onClick={() => onDensityChange(option)}
              >
                {option === 'comfortable' ? 'Confortável' : 'Compacta'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-max divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.id ?? String(index)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-normal',
                    column.numeric && 'text-right font-tabular',
                    (column.hideOnMobile || index >= 7) && 'hidden md:table-cell',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <TableSkeleton columns={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Inbox size={24} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-muted/30">
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.id ?? String(columnIndex)}
                      className={cn(
                        'px-4 text-foreground',
                        rowPadding,
                        column.numeric && 'text-right font-tabular',
                        (column.hideOnMobile || columnIndex >= 7) && 'hidden md:table-cell',
                        column.className,
                      )}
                    >
                      {getCellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pagination.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onChange(pagination.page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
