import { Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { FilterBarProps } from './types';

export function FilterBar({
  search,
  onSearchChange,
  filters,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex h-10 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 max-w-md items-center gap-2">
        <Search className="size-4 text-[var(--fg-muted)]" aria-hidden="true" />
        <input
          type="search"
          value={search ?? ''}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Buscar..."
          aria-label="Buscar"
          className="h-full w-full border-0 bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus-visible:outline-none"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">{filters}</div>

      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}
