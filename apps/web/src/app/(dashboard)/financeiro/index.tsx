import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  TrendingUp, TrendingDown, AlertTriangle, Activity,
  CreditCard, FileText, BookOpen, BarChart3,
} from 'lucide-react';

function formatBRL(cents: number) {
  const val = cents / 100;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SummaryCard({
  label, value, icon: Icon, sub, color,
}: { label: string; value: string; icon: React.ElementType; sub?: string; color: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-bold text-white truncate">{value}</p>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'ar', label: 'Contas a Receber', href: '/financeiro/contas-receber', icon: TrendingUp },
  { id: 'ap', label: 'Contas a Pagar', href: '/financeiro/contas-pagar', icon: TrendingDown },
  { id: 'closing', label: 'Fechamentos', href: '/financeiro/fechamento', icon: FileText },
  { id: 'cashbook', label: 'Livro Caixa', href: '/financeiro/livro-caixa', icon: BookOpen },
  { id: 'cashflow', label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa', icon: BarChart3 },
] as const;

export default function FinancialDashboard() {
  const { data: summary, isLoading } = trpc.financial.dashboardSummary.useQuery();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-neutral-400 text-sm mt-1">Visão geral e controle financeiro do laboratório</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="A Receber"
          icon={TrendingUp}
          value={isLoading ? '—' : formatBRL(summary?.totalReceivableCents ?? 0)}
          sub="Pendente de recebimento"
          color="bg-emerald-600"
        />
        <SummaryCard
          label="A Pagar"
          icon={TrendingDown}
          value={isLoading ? '—' : formatBRL(summary?.totalPayableCents ?? 0)}
          sub="Despesas pendentes"
          color="bg-rose-600"
        />
        <SummaryCard
          label="Vencidos"
          icon={AlertTriangle}
          value={isLoading ? '—' : formatBRL(summary?.overdueCents ?? 0)}
          sub="Contas em atraso"
          color="bg-amber-500"
        />
        <SummaryCard
          label="Fluxo do Mês"
          icon={Activity}
          value={isLoading ? '—' : formatBRL(summary?.monthFlowCents ?? 0)}
          sub="Entradas − Saídas"
          color={(summary?.monthFlowCents ?? 0) >= 0 ? 'bg-violet-600' : 'bg-orange-500'}
        />
      </div>

      {/* Quick navigation tiles */}
      <div>
        <h2 className="text-sm text-neutral-500 uppercase tracking-widest mb-3 font-medium">Módulos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TABS.map(({ id, label, href, icon: Icon }) => (
            <Link
              key={id}
              to={href}
              className="bg-neutral-900 border border-neutral-800 hover:border-violet-500/60 hover:bg-neutral-800 rounded-xl p-4 flex flex-col items-center gap-2 transition-all group"
            >
              <div className="p-2.5 bg-neutral-800 group-hover:bg-violet-600/20 rounded-lg transition-colors">
                <Icon size={18} className="text-neutral-400 group-hover:text-violet-400" />
              </div>
              <span className="text-xs text-neutral-400 group-hover:text-white text-center transition-colors">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
