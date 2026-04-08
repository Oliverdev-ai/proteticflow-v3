import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Package,
  Receipt,
  Send,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';

type Status = 'draft' | 'sent' | 'received' | 'cancelled';

const STATUS_CONFIG: Record<
  Status,
  { label: string; color: string; bg: string; icon: typeof Clock }
> = {
  draft: { label: 'Rascunho', color: 'text-muted-foreground', bg: 'bg-muted/60', icon: Clock },
  sent: { label: 'Confirmada', color: 'text-primary', bg: 'bg-primary/10', icon: Send },
  received: {
    label: 'Recebida',
    color: 'text-accent-foreground',
    bg: 'bg-accent',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    icon: XCircle,
  },
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type ReceiveDialogProps = {
  purchaseCode: string;
  totalCents: number;
  itemCount: number;
  onConfirm: (dueDate: string) => void;
  onClose: () => void;
  isPending: boolean;
};

function ReceiveDialog({
  purchaseCode,
  totalCents,
  itemCount,
  onConfirm,
  onClose,
  isPending,
}: ReceiveDialogProps) {
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().split('T')[0] ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <CheckCircle size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Confirmar Recebimento</h2>
            <p className="text-xs text-muted-foreground">Compra {purchaseCode}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-3 text-sm">
            <Package size={16} className="text-primary" />
            <span className="text-muted-foreground">
              {itemCount}{' '}
              {itemCount === 1 ? 'material será adicionado' : 'materiais serão adicionados'} ao
              estoque
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Receipt size={16} className="text-primary" />
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{fmtBRL(totalCents)}</span> será
              lançado em Contas a Pagar
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="receive-due-date" className="text-sm font-medium text-foreground">
            Vencimento do pagamento
          </label>
          <input
            id="receive-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground">
            Esta data será usada no lançamento de Contas a Pagar.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive/80">
            Esta ação é irreversível. O estoque será atualizado e o lançamento financeiro será
            criado automaticamente.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-receive"
            onClick={() => onConfirm(dueDate)}
            disabled={isPending || !dueDate}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            {isPending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <CheckCircle size={16} />
            )}
            {isPending ? 'Processando...' : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [actionError, setActionError] = useState('');

  const numericId = Number(id);
  const { data, isLoading, error } = trpc.purchases.getById.useQuery(
    { id: numericId },
    { enabled: Number.isFinite(numericId) },
  );

  const confirmMutation = trpc.purchases.confirm.useMutation({
    onSuccess: () => {
      void utils.purchases.getById.invalidate();
      void utils.purchases.list.invalidate();
    },
    onError: (err) => setActionError(err.message),
  });

  const receiveMutation = trpc.purchases.receive.useMutation({
    onSuccess: () => {
      void utils.purchases.getById.invalidate();
      void utils.purchases.list.invalidate();
      setShowReceiveDialog(false);
    },
    onError: (err) => {
      setActionError(err.message);
      setShowReceiveDialog(false);
    },
  });

  const cancelMutation = trpc.purchases.cancel.useMutation({
    onSuccess: () => {
      void utils.purchases.getById.invalidate();
      void utils.purchases.list.invalidate();
      navigate('/compras');
    },
    onError: (err) => setActionError(err.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-60 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">Compra não encontrada: {error?.message}</div>;
  }

  const { po, supplierName, supplierCnpj, items } = data;
  const cfg = STATUS_CONFIG[po.status as Status] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const isMutating =
    confirmMutation.isPending || receiveMutation.isPending || cancelMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Voltar para Compras
      </button>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle size={15} />
          {actionError}
          <button onClick={() => setActionError('')} className="ml-auto text-xs underline">
            Fechar
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-primary/10 p-2">
                <ShoppingCart size={18} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">{po.code}</h1>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
              >
                <StatusIcon size={11} />
                {cfg.label}
              </span>
            </div>

            <div className="space-y-0.5 pl-10">
              {supplierName ? (
                <p className="text-sm font-medium text-foreground">{supplierName}</p>
              ) : null}
              {supplierCnpj ? (
                <p className="text-xs text-muted-foreground">CNPJ: {supplierCnpj}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Criada em{' '}
                {new Date(po.createdAt).toLocaleDateString('pt-BR', { dateStyle: 'long' })}
              </p>
              {po.receivedAt ? (
                <p className="text-xs text-primary">
                  ✓ Recebida em{' '}
                  {new Date(po.receivedAt).toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                </p>
              ) : null}
              {po.notes ? (
                <p className="mt-2 text-xs italic text-muted-foreground">"{po.notes}"</p>
              ) : null}
            </div>

            <div className="pl-10">
              <p className="text-2xl font-bold text-primary">{fmtBRL(po.totalCents)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-col">
            {po.status === 'draft' ? (
              <button
                id="btn-confirmar"
                onClick={() => {
                  setActionError('');
                  confirmMutation.mutate({ id: po.id });
                }}
                disabled={isMutating}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                <Send size={15} />
                Confirmar Pedido
              </button>
            ) : null}

            {po.status === 'sent' ? (
              <button
                id="btn-receber"
                onClick={() => {
                  setActionError('');
                  setShowReceiveDialog(true);
                }}
                disabled={isMutating}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
              >
                <CheckCircle size={15} />
                Receber Compra
              </button>
            ) : null}

            {po.status === 'received' ? (
              <Link
                to="/financeiro/contas-pagar"
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Receipt size={15} />
                Ver Contas a Pagar
              </Link>
            ) : null}

            {po.status === 'draft' || po.status === 'sent' ? (
              <button
                id="btn-cancelar"
                onClick={() => {
                  if (!window.confirm('Confirmar cancelamento desta compra?')) return;
                  setActionError('');
                  cancelMutation.mutate({ id: po.id });
                }}
                disabled={isMutating}
                className="flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <XCircle size={15} />
                Cancelar Compra
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Package size={16} className="text-primary" />
            Itens ({items.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Material</th>
              <th className="px-4 py-3 text-right font-medium">Qtd</th>
              <th className="px-4 py-3 text-right font-medium">Preço Unit.</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map(({ item, materialName, materialUnit }) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/20">
                <td className="px-5 py-3">
                  <span className="font-medium text-foreground">
                    {materialName ?? `Material #${item.materialId}`}
                  </span>
                  {materialUnit ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">({materialUnit})</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {Number(item.quantity)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {fmtBRL(item.unitPriceCents)}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-foreground">
                  {fmtBRL(item.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td colSpan={3} className="px-5 py-3.5 text-right font-medium text-muted-foreground">
                Total
              </td>
              <td className="px-5 py-3.5 text-right text-base font-bold text-primary">
                {fmtBRL(po.totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showReceiveDialog ? (
        <ReceiveDialog
          purchaseCode={po.code}
          totalCents={po.totalCents}
          itemCount={items.length}
          isPending={receiveMutation.isPending}
          onClose={() => setShowReceiveDialog(false)}
          onConfirm={(dueDate) => {
            receiveMutation.mutate({
              id: po.id,
              dueDate: new Date(dueDate).toISOString(),
            });
          }}
        />
      ) : null}
    </div>
  );
}
