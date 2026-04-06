import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  ShoppingCart,
  Plus,
  Clock,
  CheckCircle,
  Send,
  XCircle,
  ChevronRight,
  Package,
} from 'lucide-react';

type Status = 'draft' | 'sent' | 'received' | 'cancelled';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft:     { label: 'Rascunho',  color: 'text-muted-foreground', bg: 'bg-muted/60',       icon: Clock },
  sent:      { label: 'Confirmada', color: 'text-primary',          bg: 'bg-primary/10',     icon: Send },
  received:  { label: 'Recebida',  color: 'text-accent-foreground', bg: 'bg-accent',         icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-destructive',       bg: 'bg-destructive/10', icon: XCircle },
};

const FILTERS: Array<{ value: Status | ''; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Confirmada' },
  { value: 'received', label: 'Recebida' },
  { value: 'cancelled', label: 'Cancelada' },
];

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PurchasesListPage() {
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');

  const { data, isLoading, error } = trpc.purchases.list.useQuery({
    status: (statusFilter || undefined) as Status | undefined,
    page: 1,
    limit: 50,
  });

  const purchases = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ShoppingCart size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Compras</h1>
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'pedido' : 'pedidos'} encontrado{total === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link
          to="/compras/novo"
          id="btn-nova-compra"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium shadow-md shadow-primary/20 transition-all hover:scale-[1.02]"
        >
          <Plus size={16} />
          Nova Compra
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            id={`filter-${f.value || 'all'}`}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar compras: {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && purchases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border text-center">
          <Package size={40} className="text-muted-foreground/40 mb-3" />
          <p className="text-foreground font-medium">Nenhuma compra encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em <strong>Nova Compra</strong> para começar.
          </p>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {purchases.map(({ po, supplierName }) => {
          const cfg = STATUS_CONFIG[po.status as Status] ?? STATUS_CONFIG.draft;
          const StatusIcon = cfg.icon;
          return (
            <Link
              key={po.id}
              to={`/compras/${po.id}`}
              id={`purchase-${po.id}`}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-card/80 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <ShoppingCart size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-semibold">{po.code}</span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon size={10} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {supplierName ?? 'Fornecedor não informado'} · 
                    {new Date(po.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground font-bold">{fmtBRL(po.totalCents)}</span>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
