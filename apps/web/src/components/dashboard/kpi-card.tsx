import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SparklineData } from '@proteticflow/shared';
import { cn } from '../../lib/utils';
import { ScaleIn } from '../shared/page-transition';

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  sub?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  sparkline?: SparklineData | undefined;
};

const variantColor: Record<NonNullable<KpiCardProps['variant']>, string> = {
  default: 'bg-primary',
  warning: 'bg-amber-500',
  danger: 'bg-destructive',
  success: 'bg-emerald-500',
};

const TrendIcon = { up: TrendingUp, down: TrendingDown, neutral: Minus };
const trendColor = { up: 'text-emerald-500', down: 'text-destructive', neutral: 'text-muted-foreground' };

function Sparkline({ data }: { data: SparklineData }) {
  const { points } = data;
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const w = 56;
  const h = 24;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  const strokeColor =
    data.trend === 'up' ? '#34d399' : data.trend === 'down' ? '#f87171' : '#737373';

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 opacity-80"
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
  variant = 'default',
  sparkline,
}: KpiCardProps) {
  const Trend = sparkline ? TrendIcon[sparkline.trend] : null;

  return (
    <ScaleIn className={cn("premium-card p-5 flex items-start gap-4")}>
      <div className={cn("p-2.5 rounded-2xl shrink-0 text-white shadow-sm", variantColor[variant])}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {sub && <p className="text-xs text-muted-foreground/80">{sub}</p>}
          {Trend && sparkline && (
            <span
              className={cn("flex items-center gap-0.5 text-xs font-semibold", trendColor[sparkline.trend])}
            >
              <Trend size={11} />
              {sparkline.changePercent > 0 ? '+' : ''}
              {sparkline.changePercent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {sparkline && <Sparkline data={sparkline} />}
    </ScaleIn>
  );
}
