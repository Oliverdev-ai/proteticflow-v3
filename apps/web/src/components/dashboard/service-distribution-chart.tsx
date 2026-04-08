import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ServiceDistribution } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';
import { FadeIn } from '../shared/page-transition';
import { EmptyState } from '../shared/empty-state';
import { PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['#818cf8', '#a78bfa', '#6366f1', '#4f46e5', '#3b82f6', '#0ea5e9'];

export function ServiceDistributionChart({ data }: { data: ServiceDistribution[] }) {
  const hasData = data.some((d) => d.totalCents > 0);

  return (
    <FadeIn className="premium-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-6">Distribuição de Serviços</h3>
      {!hasData ? (
        <EmptyState
          icon={PieChartIcon}
          title="Sem dados"
          description="Nenhum serviço faturado este mês"
          className="py-6"
        />
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
                background: 'rgb(var(--card))',
                border: '1px solid rgb(var(--border))',
                borderRadius: 'var(--radius)',
                color: 'rgb(var(--foreground))',
                fontSize: 12,
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
              itemStyle={{ color: 'rgb(var(--primary))' }}
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
    </FadeIn>
  );
}
