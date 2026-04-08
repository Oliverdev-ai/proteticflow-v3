import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AbcTableItem } from './abc-table';

type AbcChartMode = 'currency' | 'count';

type AbcChartProps = {
  items: AbcTableItem[];
  mode: AbcChartMode;
};

const CLASS_COLOR: Record<AbcTableItem['classification'], string> = {
  A: 'rgb(var(--primary))',
  B: 'rgb(var(--warning))',
  C: 'rgb(var(--muted-foreground))',
};

function formatAxisValue(value: number | string, mode: AbcChartMode): string {
  const normalized = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(normalized)) return '0';

  if (mode === 'currency') {
    const short = normalized / 100;
    if (short >= 1000) {
      return `R$ ${(short / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
    }
    return `R$ ${short.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  }

  return normalized.toLocaleString('pt-BR');
}

export function AbcChart({ items, mode }: AbcChartProps) {
  if (items.length === 0) {
    return (
      <div className="premium-card rounded-2xl border-dashed p-10 text-center text-sm text-muted-foreground">
        Sem dados suficientes para gerar o grafico de Pareto no periodo selecionado.
      </div>
    );
  }

  return (
    <div className="premium-card rounded-2xl p-4 md:p-6">
      <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-foreground">Grafico Pareto (Curva ABC)</h3>

      <div className="h-[430px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={items} margin={{ top: 16, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
            <XAxis
              dataKey="label"
              angle={-20}
              interval={0}
              textAnchor="end"
              height={72}
              tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
            />
            <YAxis
              yAxisId="value"
              tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
              tickFormatter={(value) => formatAxisValue(value, mode)}
            />
            <YAxis
              yAxisId="accumulated"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip />
            <Legend />

            <ReferenceLine
              yAxisId="accumulated"
              y={80}
              stroke="rgb(var(--warning))"
              strokeDasharray="4 4"
              label={{ value: '80%', position: 'insideTopRight', fill: 'rgb(var(--warning))', fontSize: 10 }}
            />
            <ReferenceLine
              yAxisId="accumulated"
              y={95}
              stroke="rgb(var(--destructive))"
              strokeDasharray="4 4"
              label={{ value: '95%', position: 'insideTopRight', fill: 'rgb(var(--destructive))', fontSize: 10 }}
            />

            <Bar yAxisId="value" dataKey="value" name={mode === 'currency' ? 'Valor' : 'Volume'}>
              {items.map((item, index) => (
                <Cell key={`${item.label}-${index}`} fill={CLASS_COLOR[item.classification]} />
              ))}
            </Bar>

            <Line
              yAxisId="accumulated"
              dataKey="accumulatedPercentage"
              name="% Acumulado"
              stroke="rgb(var(--foreground))"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
