import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { TrendingUp, TrendingDown, Clock, Loader2 } from 'lucide-react';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function BarSegment({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function FluxoCaixaPage() {
  const now = new Date();
  const [dateFrom] = useState(new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString());
  const [dateTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());

  const { data, isLoading } = trpc.financial.cashFlow.useQuery({ dateFrom, dateTo });

  const months = data?.months ?? [];
  const projection = data?.projection;

  const maxVal = Math.max(...months.map(m => Math.max(m.credits, m.debits)), 1);

  const shortMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Fluxo de Caixa</h1>
        <p className="text-neutral-400 text-sm mt-0.5">Entradas vs Saídas mensais com projeção de créditos e débitos pendentes</p>
      </div>

      {/* Projections */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-emerald-800/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-emerald-400" />
            <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Recebimentos Futuros</p>
          </div>
          <p className="text-2xl font-bold text-white">{projection ? formatBRL(projection.pendingCredits) : '—'}</p>
          <p className="text-xs text-neutral-500 mt-1">ARs com status pendente</p>
        </div>
        <div className="bg-neutral-900 border border-rose-800/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-rose-400" />
            <p className="text-xs font-medium text-rose-400 uppercase tracking-wider">Saídas Previstas</p>
          </div>
          <p className="text-2xl font-bold text-white">{projection ? formatBRL(projection.pendingDebits) : '—'}</p>
          <p className="text-xs text-neutral-500 mt-1">APs com status pendente</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-5">Histórico Mensal</h2>
        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-violet-500" size={20} /></div>
        ) : months.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-10">Nenhum dado disponível</p>
        ) : (
          <div className="space-y-3">
            {[...months].reverse().map(m => (
              <div key={m.month} className="grid grid-cols-[80px_1fr_1fr_90px] gap-3 items-center">
                <span className="text-xs text-neutral-500 text-right">{shortMonth(m.month)}</span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={10} className="text-emerald-400 shrink-0" />
                    <BarSegment value={m.credits} max={maxVal} color="bg-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={10} className="text-rose-400 shrink-0" />
                    <BarSegment value={m.debits} max={maxVal} color="bg-rose-500" />
                  </div>
                </div>
                <div className="text-xs space-y-0.5">
                  <p className="text-emerald-400">{formatBRL(m.credits)}</p>
                  <p className="text-rose-400">{formatBRL(m.debits)}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${m.net >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {formatBRL(m.net)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
