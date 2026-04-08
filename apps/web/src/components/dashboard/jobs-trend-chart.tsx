import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { JobsTrend } from '@proteticflow/shared';

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatPeriod(period: string) {
  const [, mm] = period.split('-');
  return MONTH_ABBR[mm ?? ''] ?? period;
}

type ChartEntry = { label: string; criados: number; entregues: number };

export function JobsTrendChart({ data }: { data: JobsTrend[] }) {
  const chartData: ChartEntry[] = data.map((d) => ({
    label: formatPeriod(d.period),
    criados: d.created,
    entregues: d.delivered,
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Tendência de Trabalhos</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: '#171717',
              border: '1px solid #404040',
              borderRadius: 8,
              color: '#e5e5e5',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
          <Line
            type="monotone"
            dataKey="criados"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={{ fill: '#7c3aed', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="entregues"
            stroke="#059669"
            strokeWidth={2}
            dot={{ fill: '#059669', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
