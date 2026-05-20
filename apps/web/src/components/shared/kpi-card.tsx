import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export type KpiCardProps = {
  label: string;
  value: string | number;
  format?: 'currency' | 'number' | 'percent';
  trend?: {
    value?: number;
    direction: 'up' | 'down' | 'neutral';
    format?: 'percent' | 'number';
  } | undefined;
  icon?: LucideIcon | undefined;
  loading?: boolean;
  className?: string | undefined;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

function formatValue(value: string | number, format: KpiCardProps['format']) {
  if (typeof value === 'string') return value;
  if (format === 'currency') return currencyFormatter.format(value / 100);
  if (format === 'percent') return `${numberFormatter.format(value)}%`;
  return numberFormatter.format(value);
}

function formatTrendValue(trend: NonNullable<KpiCardProps['trend']>) {
  if (trend.value === undefined) return null;
  const prefix = trend.value > 0 ? '+' : '';
  const suffix = trend.format === 'number' ? '' : '%';
  return `${prefix}${numberFormatter.format(trend.value)}${suffix}`;
}

function KpiCardSkeleton({ className }: { className?: string | undefined }) {
  return (
    <div className={cn('bg-card border border-border rounded-2xl p-5 animate-pulse', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-24 overflow-hidden rounded-pill bg-muted" />
          <div className="h-8 w-32 overflow-hidden rounded-pill bg-muted" />
        </div>
        <div className="h-10 w-10 rounded-2xl bg-muted" />
      </div>
      <div className="mt-4 h-3 w-20 rounded-pill bg-muted" />
    </div>
  );
}

export function KpiCard({
  label,
  value,
  format = 'number',
  trend,
  icon: Icon,
  loading = false,
  className,
}: KpiCardProps) {
  if (loading) return <KpiCardSkeleton className={className} />;

  const TrendIcon = trend?.direction === 'up'
    ? ArrowUpRight
    : trend?.direction === 'down'
      ? ArrowDownRight
      : ArrowRight;
  const trendValue = trend ? formatTrendValue(trend) : null;

  return (
    <div className={cn('bg-card border border-border rounded-2xl p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            {label}
          </p>
          <p className="mt-2 font-tabular text-2xl font-semibold text-foreground truncate">
            {formatValue(value, format)}
          </p>
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Icon size={20} aria-hidden="true" />
          </div>
        )}
      </div>

      {trend && (
        <div
          className={cn(
            'mt-4 inline-flex items-center gap-1 text-xs font-semibold font-tabular',
            trend.direction === 'up' && 'text-emerald-500',
            trend.direction === 'down' && 'text-red-400',
            trend.direction === 'neutral' && 'text-muted-foreground',
          )}
        >
          <TrendIcon size={14} aria-hidden="true" />
          {trendValue && <span>{trendValue}</span>}
        </div>
      )}
    </div>
  );
}
