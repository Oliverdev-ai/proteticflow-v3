import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MonthRevenue } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';
import { FadeIn } from '../shared/page-transition';

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

type ChartEntry = { period: string; label: string; value: number };

export function RevenueChart({ data }: { data: MonthRevenue[] }) {
  const chartData: ChartEntry[] = data.map((d) => ({
    period: d.period,
    label: d.period.split('-')[1] ? MONTH_ABBR[d.period.split('-')[1]!] ?? d.period : d.period,
    value: d.totalAmountCents / 100,
  }));

  return (
    <FadeIn className="premium-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-6">Receita Mensal</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border) / 0.5)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgb(var(--muted) / 0.5)' }}
            contentStyle={{
              background: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 'var(--radius)',
              color: 'rgb(var(--foreground))',
              fontSize: 12,
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            }}
            itemStyle={{ color: 'rgb(var(--primary))' }}
            formatter={(value) => [formatBRL(Number(value ?? 0) * 100), 'Receita']}
          />
          <Bar dataKey="value" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </FadeIn>
  );
}
