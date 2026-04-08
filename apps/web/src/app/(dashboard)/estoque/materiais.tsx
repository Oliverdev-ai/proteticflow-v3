import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  Search,
  Plus,
  AlertTriangle,
  ChevronLeft,
  PackagePlus,
  X,
  Box,
  Tag,
  Ruler,
  AlertCircle,
  ChevronRight,
  Database,
  Loader2,
} from 'lucide-react';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Large, Muted } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

export default function MaterialsPage() {
  const [search, setSearch] = useState('');
  const [belowMin, setBelowMin] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', unit: 'un', minStock: 0 });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.inventory.listMaterials.useQuery({
    search: search || undefined,
    belowMinimum: belowMin || undefined,
    page,
    limit: 20,
  });

  const createMaterial = trpc.inventory.createMaterial.useMutation({
    onSuccess: () => {
      utils.inventory.listMaterials.invalidate();
      setCreateOpen(false);
      setForm({ name: '', code: '', unit: 'un', minStock: 0 });
    },
  });

  const materials = data?.data ?? [];

  const inputClass =
    'w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all';
  const labelClass =
    'block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1';

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-6xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            to="/estoque"
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={3} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <H1 className="tracking-tight">Catálogo de Materiais</H1>
            <Subtitle>Gestão técnica de insumos e ponto de pedido</Subtitle>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
        >
          <PackagePlus size={16} strokeWidth={3} /> Registrar Material
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative group">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, código SKU ou barcode..."
            className={cn(inputClass, 'pl-12 bg-card/50 backdrop-blur-sm border-border/50')}
          />
        </div>

        <button
          onClick={() => setBelowMin((b) => !b)}
          className={cn(
            'flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border',
            belowMin
              ? 'bg-destructive/10 text-destructive border-destructive/20 shadow-lg shadow-destructive/5'
              : 'bg-card/50 text-muted-foreground border-border/50 hover:border-primary/30',
          )}
        >
          <AlertTriangle size={14} strokeWidth={3} />{' '}
          {belowMin ? 'Filtrando: Críticos' : 'Estoque Crítico'}
        </button>
      </div>

      {/* Content Area */}
      <ScaleIn>
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Database className="animate-pulse text-primary/20" size={48} />
            <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">
              Sincronizando inventário...
            </Muted>
          </div>
        ) : (
          <div className="premium-card overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Insumo / Material
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    SKU / Identificador
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Unidade
                  </th>
                  <th className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Nível de Estoque
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Estoque Mín.
                  </th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20">
                      <EmptyState
                        icon={Box}
                        title="Nenhum material encontrado"
                        description="Sua busca não retornou resultados ou o catálogo está vazio."
                      >
                        <button
                          onClick={() => {
                            setSearch('');
                            setBelowMin(false);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                        >
                          Limpar filtros
                        </button>
                      </EmptyState>
                    </td>
                  </tr>
                ) : (
                  materials.map((mat) => {
                    const stock = Number(mat.currentStock);
                    const min = Number(mat.minStock);
                    const isLow = min > 0 && stock < min;

                    return (
                      <tr key={mat.id} className="group hover:bg-primary/[0.02] transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center shadow-inner',
                                isLow
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-primary/10 text-primary',
                              )}
                            >
                              <Box size={20} />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <p
                                className={cn(
                                  'text-sm font-black tracking-tight',
                                  isLow ? 'text-destructive' : 'text-foreground',
                                )}
                              >
                                {mat.name}
                              </p>
                              {isLow && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-destructive/60 animate-pulse">
                                  Reposição Urgente
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-xs font-bold text-muted-foreground px-3 py-1 bg-muted/50 rounded-lg border border-border/50 uppercase tracking-widest">
                            {mat.code ?? 'SEM CÓDIGO'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                            {mat.unit}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Large
                              className={cn(
                                'font-black tracking-tighter text-lg leading-none',
                                isLow ? 'text-destructive' : 'text-foreground',
                              )}
                            >
                              {stock}
                            </Large>
                            <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all',
                                  isLow ? 'bg-destructive' : 'bg-emerald-500',
                                )}
                                style={{ width: `${Math.min(100, (stock / (min || 1)) * 50)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-muted-foreground">
                          {min}
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <Link
                            to={`/estoque/material/${mat.id}`}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 px-4 py-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all ml-auto"
                          >
                            Detalhes <ChevronRight size={14} strokeWidth={3} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Modern Controls */}
        {(data?.total ?? 0) > 20 && (
          <div className="flex items-center justify-between mt-8 bg-card/30 backdrop-blur-sm p-4 rounded-[28px] border border-border/50 shadow-sm">
            <Muted className="text-[10px] font-bold uppercase tracking-widest ml-4">
              Página {page} de {Math.ceil((data?.total ?? 0) / 20)}
            </Muted>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-6 py-3 bg-muted border border-border text-[10px] font-black uppercase tracking-widest rounded-2xl disabled:opacity-30 hover:text-primary transition-all active:scale-95"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={materials.length < 20}
                className="px-6 py-3 bg-muted border border-border text-[10px] font-black uppercase tracking-widest rounded-2xl disabled:opacity-30 hover:text-primary transition-all active:scale-95"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </ScaleIn>

      {/* Premium Create Modal with Framer-like animation context */}
      {createOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-xl">
            <div className="premium-card p-10 flex flex-col gap-10 relative shadow-2xl border-primary/20 overflow-hidden">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />

              <div className="flex justify-between items-start relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <PackagePlus size={24} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter">Novo Material</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Cadastro técnico de insumo
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome do Material *</label>
                  <div className="relative">
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Resina Z350 XT A2B"
                      className={inputClass}
                    />
                    <Box
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Referência / SKU</label>
                  <div className="relative">
                    <input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="00X-AAA-99"
                      className={inputClass}
                    />
                    <Tag
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Unidade de Medida</label>
                  <div className="relative">
                    <input
                      value={form.unit}
                      onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="un, ml, kg, g..."
                      className={inputClass}
                    />
                    <Ruler
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={18}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Estoque Mínimo (Ponto de Pedido)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={form.minStock}
                      onChange={(e) => setForm((f) => ({ ...f, minStock: Number(e.target.value) }))}
                      className={cn(inputClass, 'font-mono font-bold text-lg')}
                    />
                    <AlertCircle
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary opacity-50"
                      size={20}
                    />
                  </div>
                  <Muted className="text-[9px] uppercase font-bold tracking-widest mt-3 leading-relaxed">
                    O sistema emitirá alertas automáticos quando o saldo real atingir este valor.
                  </Muted>
                </div>
              </div>

              <div className="flex gap-4 pt-6 mt-4 border-t border-border/50 relative">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-95"
                >
                  Descartar
                </button>
                <button
                  onClick={() =>
                    createMaterial.mutate({
                      name: form.name,
                      code: form.code || undefined,
                      unit: form.unit,
                      minStock: form.minStock,
                    })
                  }
                  disabled={!form.name.trim() || createMaterial.isPending}
                  className="flex-[1.5] py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                >
                  {createMaterial.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={3} /> Confirmar Cadastro
                    </>
                  )}
                </button>
              </div>
            </div>
          </ScaleIn>
        </div>
      )}
    </PageTransition>
  );
}
