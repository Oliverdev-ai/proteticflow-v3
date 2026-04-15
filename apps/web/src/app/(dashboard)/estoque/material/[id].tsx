import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Box, CalendarClock, CircleDollarSign, History, Package } from 'lucide-react';
import { trpc } from '../../../../lib/trpc';

function formatStock(value: string | number): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatCurrency(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function movementTypeLabel(type: 'in' | 'out' | 'adjustment'): string {
  if (type === 'in') return 'Entrada';
  if (type === 'out') return 'Saida';
  return 'Ajuste';
}

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const materialId = Number(id);
  const hasValidId = Number.isFinite(materialId) && materialId > 0;

  const materialQuery = trpc.inventory.getMaterial.useQuery(
    { id: materialId },
    { enabled: hasValidId },
  );
  const movementsQuery = trpc.inventory.listMovements.useQuery(
    { materialId, limit: 50 },
    { enabled: hasValidId },
  );

  if (!hasValidId) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <p className="text-sm text-destructive">Material invalido.</p>
        <Link to="/estoque/materiais" className="text-sm text-primary hover:underline">
          Voltar para materiais
        </Link>
      </div>
    );
  }

  if (materialQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (materialQuery.error || !materialQuery.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <p className="text-sm text-destructive">
          Falha ao carregar material: {materialQuery.error?.message ?? 'Nao encontrado'}
        </p>
        <Link to="/estoque/materiais" className="text-sm text-primary hover:underline">
          Voltar para materiais
        </Link>
      </div>
    );
  }

  const material = materialQuery.data;
  const movements = movementsQuery.data?.data ?? [];

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 overflow-auto p-6">
      <Link
        to="/estoque/materiais"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Voltar para Materiais
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
              <Box size={14} />
              Material
            </div>
            <h1 className="text-2xl font-black text-foreground">{material.name}</h1>
            <p className="text-sm text-muted-foreground">
              Codigo: {material.code ?? 'Nao informado'} | Unidade: {material.unit}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Saldo atual
            </p>
            <p className="text-2xl font-black text-foreground">{formatStock(material.currentStock)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Package size={14} />
            Estoque Minimo
          </div>
          <p className="text-xl font-black text-foreground">{formatStock(material.minStock)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <CircleDollarSign size={14} />
            Custo Medio
          </div>
          <p className="text-xl font-black text-foreground">{formatCurrency(material.averageCostCents)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <CircleDollarSign size={14} />
            Ultima Compra
          </div>
          <p className="text-xl font-black text-foreground">{formatCurrency(material.lastPurchasePriceCents)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <History size={16} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
            Movimentacoes Recentes
          </h2>
        </div>

        {movementsQuery.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando movimentacoes...</div>
        ) : movementsQuery.error ? (
          <div className="p-6 text-sm text-destructive">
            Falha ao carregar movimentacoes: {movementsQuery.error.message}
          </div>
        ) : movements.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma movimentacao encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Data</th>
                <th className="px-4 py-3 text-left font-bold">Tipo</th>
                <th className="px-4 py-3 text-right font-bold">Quantidade</th>
                <th className="px-4 py-3 text-right font-bold">Saldo apos</th>
                <th className="px-4 py-3 text-left font-bold">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map(({ movement }) => (
                <tr key={movement.id}>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={13} />
                      {new Date(movement.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {movementTypeLabel(movement.type)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatStock(movement.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatStock(movement.stockAfter)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{movement.reason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
