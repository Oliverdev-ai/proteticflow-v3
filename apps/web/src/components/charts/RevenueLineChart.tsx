import { useEffect, useRef } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartTooltip } from './chart-tooltip';

export type RevenueLineChartPoint = {
  label: string;
  value: number;
  comparison?: number;
};

export type RevenueLineChartProps = {
  data: RevenueLineChartPoint[];
  title?: string;
  loading?: boolean;
  valueFormatter?: (value: string | number) => string;
};

export function RevenueLineChart({
  data,
  title = 'Receita',
  loading = false,
  valueFormatter,
}: RevenueLineChartProps) {
  const shouldAnimate = useRef(true);
  const animate = shouldAnimate.current;

  useEffect(() => {
    shouldAnimate.current = false;
  }, []);

  if (loading) return <ChartSkeleton />;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-6 text-sm font-semibold text-foreground">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            width={44}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={valueFormatter} />}
            cursor={{ stroke: 'var(--border)' }}
            wrapperStyle={{ outline: 'none' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Receita"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={animate}
          />
          <Line
            type="monotone"
            dataKey="comparison"
            name="Comparação"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={animate}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
