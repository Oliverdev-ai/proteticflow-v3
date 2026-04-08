import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Upload,
  Download,
  Percent,
  Trash2,
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';

function formatCents(c: number) {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PricingTableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tableId = parseInt(id ?? '0', 10);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    priceCents: '',
    estimatedDays: '5',
    code: '',
  });
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: { line: number; message: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    data: table,
    isLoading: tableLoading,
    error: tableError,
  } = trpc.pricing.getTable.useQuery({ id: tableId });
  const {
    data: items,
    isLoading: itemsLoading,
    refetch,
  } = trpc.pricing.listItems.useQuery({
    pricingTableId: tableId,
    search: search || undefined,
    page,
    limit: 20,
  });

  const bulkMutation = trpc.pricing.bulkAdjust.useMutation({
    onSuccess: (r) => {
      setShowBulk(false);
      setBulkPercent('');
      refetch();
      alert(`${r.adjusted} itens reajustados!`);
    },
  });

  const createItemMutation = trpc.pricing.createItem.useMutation({
    onSuccess: () => {
      setShowAddItem(false);
      setNewItem({ name: '', category: '', priceCents: '', estimatedDays: '5', code: '' });
      refetch();
    },
  });

  const deleteItemMutation = trpc.pricing.deleteItem.useMutation({ onSuccess: () => refetch() });

  const exportQuery = trpc.pricing.exportCsv.useQuery({ tableId }, { enabled: false });
  const importMutation = trpc.pricing.importCsv.useMutation({
    onSuccess: (r) => {
      setImportResult(r);
      refetch();
    },
  });

  const handleExport = async () => {
    const res = await exportQuery.refetch();
    if (res.data) {
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tabela-${tableId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      importMutation.mutate({ tableId, csvContent: content });
    };
    reader.readAsText(file);
  };

  if (tableLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  if (tableError || !table)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-red-400 text-sm">{tableError?.message ?? 'Tabela não encontrada'}</p>
        <button
          onClick={() => navigate('/precos')}
          className="text-xs text-primary hover:text-primary transition-colors"
        >
          ← Voltar
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/precos')}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">{table.name}</h1>
          {table.isDefault && (
            <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">
              Padrão
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-primary hover:border-primary px-3 py-2 rounded-xl transition-colors"
          >
            <Percent size={13} /> Reajuste
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-primary hover:border-primary px-3 py-2 rounded-xl transition-colors"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-primary hover:border-primary px-3 py-2 rounded-xl transition-colors"
          >
            <Upload size={13} /> Importar CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary text-white px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={13} /> Novo item
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-sm text-white font-medium">Resultado do import</p>
          <p className="text-xs text-green-400">
            {importResult.created} criados · {importResult.updated} atualizados
          </p>
          {importResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-400">
              Linha {e.line}: {e.message}
            </p>
          ))}
          <button
            onClick={() => setImportResult(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por nome ou código..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Table */}
      {itemsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : items?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <p className="text-zinc-500 text-sm">Nenhum item nesta tabela.</p>
          <button
            onClick={() => setShowAddItem(true)}
            className="text-xs text-primary hover:text-primary transition-colors"
          >
            + Adicionar primeiro item
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3">Nome</th>
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3 hidden sm:table-cell">
                  Código
                </th>
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3 hidden md:table-cell">
                  Categoria
                </th>
                <th className="text-right text-xs font-semibold text-zinc-500 px-5 py-3">Preço</th>
                <th className="text-right text-xs font-semibold text-zinc-500 px-5 py-3 hidden sm:table-cell">
                  Prazo
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items?.data.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${idx === items.data.length - 1 ? 'border-0' : ''}`}
                >
                  <td className="px-5 py-3.5">
                    <p className="text-white text-sm font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-zinc-400 text-xs font-mono">{item.code || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-zinc-400 text-sm">{item.category}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-primary font-semibold text-sm">
                      {formatCents(item.priceCents)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    <span className="text-zinc-400 text-sm">{item.estimatedDays}d</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => {
                        if (confirm('Remover item?')) deleteItemMutation.mutate({ id: item.id });
                      }}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">Reajuste em lote</h2>
            <p className="text-zinc-400 text-xs">
              Aplicado a todos os itens ativos desta tabela. Use valores negativos para desconto.
            </p>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Percentual (%)</label>
              <input
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                type="number"
                step="0.01"
                placeholder="Ex: 10 ou -5"
                className="input-field w-full"
                autoFocus
              />
            </div>
            {bulkMutation.error && (
              <p className="text-red-400 text-xs">{bulkMutation.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulk(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!bulkPercent || bulkMutation.isPending}
                onClick={() =>
                  bulkMutation.mutate({
                    pricingTableId: tableId,
                    adjustmentPercent: parseFloat(bulkPercent),
                  })
                }
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {bulkMutation.isPending ? 'Aplicando...' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add item modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">Novo Item</h2>
            {['name', 'code', 'category', 'priceCents', 'estimatedDays'].map((f) => (
              <div key={f}>
                <label className="block text-xs text-zinc-400 mb-1.5 capitalize">
                  {f === 'priceCents'
                    ? 'Preço (centavos)'
                    : f === 'estimatedDays'
                      ? 'Prazo (dias)'
                      : f}
                </label>
                <input
                  value={newItem[f as keyof typeof newItem]}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, [f]: e.target.value }))}
                  type={['priceCents', 'estimatedDays'].includes(f) ? 'number' : 'text'}
                  className="input-field w-full"
                />
              </div>
            ))}
            {createItemMutation.error && (
              <p className="text-red-400 text-xs">{createItemMutation.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={
                  !newItem.name ||
                  !newItem.category ||
                  !newItem.priceCents ||
                  createItemMutation.isPending
                }
                onClick={() =>
                  createItemMutation.mutate({
                    pricingTableId: tableId,
                    name: newItem.name,
                    code: newItem.code || undefined,
                    category: newItem.category,
                    priceCents: parseInt(newItem.priceCents, 10),
                    estimatedDays: parseInt(newItem.estimatedDays, 10) || 5,
                  })
                }
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {createItemMutation.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
