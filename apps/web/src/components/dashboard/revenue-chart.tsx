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

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatPeriod(period: string) {
  const [, mm] = period.split('-');
  return MONTH_ABBR[mm ?? ''] ?? period;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type ChartEntry = { period: string; label: string; value: number };

export function RevenueChart({ data }: { data: MonthRevenue[] }) {
  const chartData: ChartEntry[] = data.map((d) => ({
    period: d.period,
    label: formatPeriod(d.period),
    value: d.totalAmountCents / 100,
  }));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Receita Mensal</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#737373', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            width={40}
          />
          <Tooltip
            cursor={{ fill: '#262626' }}
            contentStyle={{
              background: '#171717',
              border: '1px solid #404040',
              borderRadius: 8,
              color: '#e5e5e5',
              fontSize: 12,
            }}
            formatter={(value) => [formatBRL(Number(value ?? 0) * 100), 'Receita']}
          />
          <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
