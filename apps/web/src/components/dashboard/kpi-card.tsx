import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
};

const variantColor: Record<NonNullable<KpiCardProps['variant']>, string> = {
  default: 'bg-violet-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  success: 'bg-emerald-600',
};

const TrendIcon = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColor = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  neutral: 'text-neutral-400',
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  trend,
  trendLabel,
  variant = 'default',
}: KpiCardProps) {
  const Trend = trend ? TrendIcon[trend] : null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${variantColor[variant]}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-bold text-white truncate">{value}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {sub && <p className="text-xs text-neutral-400">{sub}</p>}
          {Trend && trendLabel && (
            <span className={`flex items-center gap-0.5 text-xs ${trendColor[trend!]}`}>
              <Trend size={11} />
              {trendLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
