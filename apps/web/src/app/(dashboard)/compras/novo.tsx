import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Plus, Trash2, ShoppingCart, Search, Package } from 'lucide-react';

type PurchaseItem = {
  materialId: number;
  materialName: string;
  materialUnit: string;
  quantity: number;
  unitPriceCents: number;
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function centsToBRL(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function brlToCents(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

export default function PurchaseFormPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Queries
  const { data: suppliersData } = trpc.purchases.listSuppliers.useQuery(
    { search: supplierSearch || undefined },
    { enabled: supplierSearch.length > 0 || !supplierId },
  );
  const { data: materialsData } = trpc.purchases.listMaterials.useQuery(
    { search: materialSearch || undefined },
    { enabled: materialSearch.length > 0 },
  );

  const suppliers = suppliersData ?? [];
  const materials = materialsData ?? [];

  const createPurchase = trpc.purchases.create.useMutation({
    onSuccess: (po) => {
      if (!po) return;
      void utils.purchases.list.invalidate();
      navigate(`/compras/${po.id}`);
    },
    onError: (err) => setError(err.message),
  });

  // Total
  const totalCents = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0,
  );

  const addMaterial = useCallback(
    (mat: { id: number; name: string; unit: string; lastPurchasePriceCents: number | null }) => {
      setItems((prev) => [
        ...prev,
        {
          materialId: mat.id,
          materialName: mat.name,
          materialUnit: mat.unit,
          quantity: 1,
          unitPriceCents: mat.lastPurchasePriceCents ?? 0,
        },
      ]);
      setMaterialSearch('');
    },
    [],
  );

  const updateItem = useCallback(
    (idx: number, field: 'quantity' | 'unitPriceCents', value: number) => {
      setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
    },
    [],
  );

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = () => {
    setError('');
    if (!supplierId) {
      setError('Selecione um fornecedor');
      return;
    }
    if (items.length === 0) {
      setError('Adicione pelo menos 1 item');
      return;
    }
    const hasZeroQty = items.some((i) => i.quantity <= 0);
    if (hasZeroQty) {
      setError('Todos os itens devem ter quantidade maior que zero');
      return;
    }
    const hasZeroPrice = items.some((i) => i.unitPriceCents <= 0);
    if (hasZeroPrice) {
      setError('Todos os itens devem ter preço unitário maior que zero');
      return;
    }

    createPurchase.mutate({
      supplierId,
      notes: notes || undefined,
      items: items.map((i) => ({
        materialId: i.materialId,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Nova Compra</h1>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Fornecedor */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Fornecedor</h2>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="supplier-search"
            type="text"
            placeholder="Buscar fornecedor..."
            value={supplierSearch}
            onChange={(e) => {
              setSupplierSearch(e.target.value);
              setSupplierId(null);
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {suppliers.length > 0 && !supplierId && (
          <div className="border border-border rounded-lg overflow-hidden">
            {suppliers.map((sup) => (
              <button
                key={sup.id}
                id={`supplier-${sup.id}`}
                onClick={() => {
                  setSupplierId(sup.id);
                  setSupplierSearch(sup.name);
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 text-left border-b border-border last:border-0 transition-colors"
              >
                <span className="text-sm text-foreground font-medium">{sup.name}</span>
                {sup.cnpj && <span className="text-xs text-muted-foreground">{sup.cnpj}</span>}
              </button>
            ))}
          </div>
        )}
        {supplierId && (
          <p className="text-sm text-primary flex items-center gap-1.5">
            <CheckIcon /> Fornecedor selecionado
          </p>
        )}
      </div>

      {/* Itens */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Itens da Compra</h2>

        {/* Busca de material */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="material-search"
            type="text"
            placeholder="Buscar material para adicionar..."
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {materials.length > 0 && materialSearch && (
          <div className="border border-border rounded-lg overflow-hidden">
            {materials.map((mat) => (
              <button
                key={mat.id}
                id={`mat-${mat.id}`}
                onClick={() => addMaterial(mat)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 text-left border-b border-border last:border-0 transition-colors"
              >
                <div>
                  <span className="text-sm text-foreground font-medium">{mat.name}</span>
                  {mat.code && (
                    <span className="text-xs text-muted-foreground ml-2">({mat.code})</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{mat.unit}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tabela de itens */}
        {items.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Material</th>
                  <th className="text-center px-3 py-2.5 font-medium w-28">Qtd</th>
                  <th className="text-center px-3 py-2.5 font-medium w-32">Preço Unit.</th>
                  <th className="text-right px-4 py-2.5 font-medium w-28">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className="text-foreground font-medium">{item.materialName}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({item.materialUnit})
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        id={`qty-${idx}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-center px-2 py-1 rounded border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        id={`price-${idx}`}
                        type="text"
                        value={centsToBRL(item.unitPriceCents)}
                        onChange={(e) =>
                          updateItem(idx, 'unitPriceCents', brlToCents(e.target.value))
                        }
                        className="w-full text-center px-2 py-1 rounded border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground font-semibold">
                      {fmtBRL(Math.round(item.quantity * item.unitPriceCents))}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        id={`remove-${idx}`}
                        onClick={() => removeItem(idx)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Remover item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t border-border">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-muted-foreground font-medium text-sm"
                  >
                    Total da compra
                  </td>
                  <td className="px-4 py-3 text-right text-primary font-bold">
                    {fmtBRL(totalCents)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <Package size={32} className="mb-2 opacity-40" />
            <p className="text-sm">Busque e adicione materiais acima.</p>
          </div>
        )}
      </div>

      {/* Observações */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-foreground">Observações</h2>
        <textarea
          id="purchase-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informações adicionais sobre esta compra (opcional)..."
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
        >
          Cancelar
        </button>
        <button
          id="btn-salvar-compra"
          onClick={handleSubmit}
          disabled={createPurchase.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm shadow-md shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:scale-100"
        >
          {createPurchase.isPending ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
          ) : (
            <Plus size={16} />
          )}
          {createPurchase.isPending ? 'Salvando...' : 'Salvar Compra'}
        </button>
      </div>
    </div>
  );
}

// Ícone inline para evitar dependência
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}
