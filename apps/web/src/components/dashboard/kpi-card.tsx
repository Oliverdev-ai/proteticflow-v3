import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SparklineData } from '@proteticflow/shared';

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  sub?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  sparkline?: SparklineData | undefined;
};

const variantColor: Record<NonNullable<KpiCardProps['variant']>, string> = {
  default: 'bg-violet-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  success: 'bg-emerald-600',
};

const TrendIcon = { up: TrendingUp, down: TrendingDown, neutral: Minus };
const trendColor = { up: 'text-emerald-400', down: 'text-rose-400', neutral: 'text-neutral-400' };

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
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${variantColor[variant]}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-bold text-white truncate">{value}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {sub && <p className="text-xs text-neutral-400">{sub}</p>}
          {Trend && sparkline && (
            <span
              className={`flex items-center gap-0.5 text-xs ${trendColor[sparkline.trend]}`}
            >
              <Trend size={11} />
              {sparkline.changePercent > 0 ? '+' : ''}
              {sparkline.changePercent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {sparkline && <Sparkline data={sparkline} />}
    </div>
  );
}
