import { useEffect, useRef } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './chart-tooltip';

export type JobsBarChartDatum = {
  label: string;
  [key: string]: string | number;
};

export type JobsBarSeries = {
  dataKey: string;
  label: string;
  variant?: 'primary' | 'accent';
};

export type JobsBarChartProps = {
  data: JobsBarChartDatum[];
  title?: string;
  loading?: boolean;
  bars?: JobsBarSeries[];
};

const DEFAULT_BARS: JobsBarSeries[] = [
  { dataKey: 'value', label: 'Trabalhos', variant: 'primary' },
];

export function JobsBarChart({
  data,
  title = 'Trabalhos',
  loading = false,
  bars = DEFAULT_BARS,
}: JobsBarChartProps) {
  const shouldAnimate = useRef(true);
  const animate = shouldAnimate.current;

  useEffect(() => {
    shouldAnimate.current = false;
  }, []);

  if (loading) return <ChartSkeleton />;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-6 text-sm font-semibold text-foreground">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'var(--muted)' }}
            wrapperStyle={{ outline: 'none' }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label}
              fill={bar.variant === 'accent' ? 'var(--accent)' : 'var(--primary)'}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              isAnimationActive={animate}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
