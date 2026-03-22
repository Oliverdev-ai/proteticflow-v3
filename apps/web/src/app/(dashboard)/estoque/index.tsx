import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  Package, AlertTriangle, ShoppingCart, TrendingUp, BarChart3,
  ChevronRight, Plus,
} from 'lucide-react';

function SummaryCard({ icon: Icon, label, value, sub, accent = false }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`bg-neutral-900 border rounded-xl p-5 ${accent ? 'border-red-800' : 'border-neutral-800'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${accent ? 'bg-red-900/30' : 'bg-violet-900/30'}`}>
          <Icon size={18} className={accent ? 'text-red-400' : 'text-violet-400'} />
        </div>
        <span className="text-sm text-neutral-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

const QUICK_LINKS = [
  { label: 'Materiais', href: '/estoque/materiais', desc: 'Catálogo e movimentações', icon: Package },
  { label: 'Fornecedores', href: '/estoque/fornecedores', desc: 'Gestão de fornecedores', icon: TrendingUp },
  { label: 'Ordens de Compra', href: '/estoque/ordens-compra', desc: 'Criar e receber OCs', icon: ShoppingCart },
];

export default function InventoryDashboard() {
  const { data: dash } = trpc.inventory.getDashboard.useQuery();

  const totalValue = dash ? (dash.totalValueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-violet-500" size={24} /> Estoque
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Visão geral do estoque do laboratório</p>
        </div>
        <Link
          to="/estoque/materiais"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Package size={16} /> Ver Materiais
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={Package} label="Total de Materiais" value={dash?.totalMaterials ?? '-'} />
        <SummaryCard icon={AlertTriangle} label="Abaixo do Mínimo" value={dash?.belowMinimum ?? '-'} sub="Requer reposição" accent={(dash?.belowMinimum ?? 0) > 0} />
        <SummaryCard icon={BarChart3} label="Valor Total em Estoque" value={totalValue} />
        <SummaryCard icon={ShoppingCart} label="OCs Aguardando" value={dash?.pendingPOs ?? '-'} sub="Enviadas, não recebidas" accent={(dash?.pendingPOs ?? 0) > 0} />
      </div>

      {/* Quick access */}
      <h2 className="text-lg font-semibold text-white mb-4">Acesso Rápido</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_LINKS.map(({ label, href, desc, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-violet-700 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-violet-900/20 rounded-lg group-hover:bg-violet-900/40 transition-colors">
                <Icon size={18} className="text-violet-400" />
              </div>
              <ChevronRight size={16} className="text-neutral-600 group-hover:text-violet-400 transition-colors" />
            </div>
            <p className="text-white font-medium">{label}</p>
            <p className="text-neutral-500 text-xs mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
