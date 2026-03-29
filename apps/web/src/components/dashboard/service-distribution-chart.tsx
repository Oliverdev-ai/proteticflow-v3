import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ServiceDistribution } from '@proteticflow/shared';

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626'];

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ServiceDistributionChart({ data }: { data: ServiceDistribution[] }) {
  const hasData = data.some((d) => d.totalCents > 0);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-neutral-300 mb-4">Distribuição de Serviços</h3>
      {!hasData ? (
        <p className="text-xs text-neutral-500 py-12 text-center">
          Nenhum serviço faturado este mês
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="totalCents"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length] ?? '#7c3aed'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#171717',
                border: '1px solid #404040',
                borderRadius: 8,
                color: '#e5e5e5',
                fontSize: 12,
              }}
              formatter={(value) => [formatBRL(Number(value ?? 0)), 'Receita']}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }}
              formatter={(value: string) =>
                value.length > 20 ? value.slice(0, 20) + '…' : value
              }
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
