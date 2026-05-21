import { useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { PageTransition } from '../../../components/shared/page-transition';
import { H1, Muted, Subtitle } from '../../../components/shared/typography';
import { DataTable, type ColumnDef } from '../../../components/shared/data-table';
import { CurrencyInput } from '../../../components/shared/currency-input';
import { RevenueLineChart } from '../../../components/charts';
import { cn } from '../../../lib/utils';

type FinanceTab = 'receber' | 'pagar' | 'fluxo';
type FinancialStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

type ArRow = {
  ar: {
    id: number;
    jobId: number;
    clientId: number;
    amountCents: number;
    description: string | null;
    dueDate: string | Date;
    paidAt: string | Date | null;
    paymentMethod: string | null;
    status: FinancialStatus;
  };
  clientName: string | null;
};

type ApRow = {
  id: number;
  description: string;
  supplier: string | null;
  category: string | null;
  amountCents: number;
  dueDate: string | Date;
  paidAt: string | Date | null;
  paymentMethod: string | null;
  status: FinancialStatus;
};

type ClientOption = {
  id: number;
  name: string;
  clinic: string | null;
};

const STATUS_LABEL: Record<FinancialStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

function dateToInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

function shortMonth(month: string): string {
  const [year = '2026', monthValue = '1'] = month.split('-');
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(
    new Date(Number(year), Number(monthValue) - 1, 1),
  );
}

function StatusBadge({ status }: { status: FinancialStatus }) {
  const tone = {
    pending: 'border-warning/30 bg-warning/10 text-warning',
    paid: 'border-success/25 bg-success/10 text-success',
    overdue: 'border-destructive/25 bg-destructive/10 text-destructive',
    cancelled: 'border-border bg-muted text-muted-foreground',
  }[status];

  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase', tone)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
      <button type="button" className="flex-1 cursor-default" aria-label="Fechar drawer" onClick={onClose} />
      <aside className="h-full w-full max-w-lg overflow-auto border-l border-border bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-muted" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'success' | 'destructive' | 'warning' | 'primary';
}) {
  const toneClass = {
    success: 'text-success bg-success/10 border-success/20',
    destructive: 'text-destructive bg-destructive/10 border-destructive/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    primary: 'text-primary bg-primary/10 border-primary/20',
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={cn('mb-4 flex h-11 w-11 items-center justify-center rounded-xl border', toneClass)}>
        <Icon size={20} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-tabular text-2xl font-semibold text-foreground">{formatBRL(value)}</p>
    </div>
  );
}

export default function FinancialDashboard() {
  const now = new Date();
  const [tab, setTab] = useState<FinanceTab>('receber');
  const [arStatus, setArStatus] = useState<FinancialStatus | undefined>('pending');
  const [apStatus, setApStatus] = useState<FinancialStatus | undefined>('pending');
  const [drawer, setDrawer] = useState<'ar' | 'ap' | null>(null);
  const [settlement, setSettlement] = useState<{ kind: 'ar' | 'ap'; id: number; label: string } | null>(null);
  const [arForm, setArForm] = useState({
    clientId: '',
    jobId: '',
    amountCents: 0,
    dueDate: dateToInput(now),
    description: '',
  });
  const [apForm, setApForm] = useState({
    description: '',
    supplier: '',
    category: '',
    amountCents: 0,
    dueDate: dateToInput(now),
    notes: '',
  });
  const [settlementForm, setSettlementForm] = useState({ paymentMethod: 'pix', notes: '' });

  const utils = trpc.useUtils();
  const summaryQuery = trpc.financial.dashboardSummary.useQuery();
  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100, status: 'active' });
  const arQuery = trpc.financial.listAr.useQuery({ status: arStatus, limit: 50 });
  const apQuery = trpc.financial.listAp.useQuery({ status: apStatus, limit: 50 });
  const cashFlowQuery = trpc.financial.cashFlow.useQuery({
    dateFrom: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString(),
    dateTo: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  });

  const invalidateFinancial = async () => {
    await Promise.all([
      utils.financial.dashboardSummary.invalidate(),
      utils.financial.listAr.invalidate(),
      utils.financial.listAp.invalidate(),
      utils.financial.cashFlow.invalidate(),
      utils.clientes.list.invalidate(),
    ]);
  };

  const createAr = trpc.financial.createAr.useMutation({
    onSuccess: () => {
      setDrawer(null);
      setArForm({ clientId: '', jobId: '', amountCents: 0, dueDate: dateToInput(new Date()), description: '' });
      void invalidateFinancial();
    },
  });
  const createAp = trpc.financial.createAp.useMutation({
    onSuccess: () => {
      setDrawer(null);
      setApForm({ description: '', supplier: '', category: '', amountCents: 0, dueDate: dateToInput(new Date()), notes: '' });
      void invalidateFinancial();
    },
  });
  const markArPaid = trpc.financial.markArPaid.useMutation({
    onSuccess: () => {
      setSettlement(null);
      setSettlementForm({ paymentMethod: 'pix', notes: '' });
      void invalidateFinancial();
    },
  });
  const markApPaid = trpc.financial.markApPaid.useMutation({
    onSuccess: () => {
      setSettlement(null);
      setSettlementForm({ paymentMethod: 'pix', notes: '' });
      void invalidateFinancial();
    },
  });

  const clientOptions = (clientsQuery.data?.data ?? []) as ClientOption[];
  const arRows = (arQuery.data?.data ?? []) as ArRow[];
  const apRows = (apQuery.data?.data ?? []) as ApRow[];
  const cashFlowData = (cashFlowQuery.data?.months ?? []).map((month) => ({
    label: shortMonth(month.month),
    value: month.credits,
    comparison: month.debits,
  }));

  const arColumns: ColumnDef<ArRow>[] = [
    { header: 'Cliente', cell: (row) => row.clientName ?? `Cliente #${row.ar.clientId}` },
    { header: 'Descrição', accessor: (row) => row.ar.description || `OS #${row.ar.jobId}` },
    { header: 'Vencimento', accessor: (row) => new Date(row.ar.dueDate).toLocaleDateString('pt-BR') },
    { header: 'Status', cell: (row) => <StatusBadge status={row.ar.status} /> },
    { header: 'Valor', numeric: true, accessor: (row) => formatBRL(row.ar.amountCents) },
    {
      id: 'actions',
      header: '',
      cell: (row) => row.ar.status === 'pending' || row.ar.status === 'overdue' ? (
        <button
          type="button"
          onClick={() => setSettlement({ kind: 'ar', id: row.ar.id, label: row.clientName ?? `AR #${row.ar.id}` })}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
        >
          Baixar
        </button>
      ) : null,
    },
  ];

  const apColumns: ColumnDef<ApRow>[] = [
    { header: 'Descrição', accessor: 'description' },
    { header: 'Fornecedor', accessor: (row) => row.supplier || 'Sem fornecedor' },
    { header: 'Vencimento', accessor: (row) => new Date(row.dueDate).toLocaleDateString('pt-BR') },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    { header: 'Valor', numeric: true, accessor: (row) => formatBRL(row.amountCents) },
    {
      id: 'actions',
      header: '',
      cell: (row) => row.status === 'pending' || row.status === 'overdue' ? (
        <button
          type="button"
          onClick={() => setSettlement({ kind: 'ap', id: row.id, label: row.description })}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
        >
          Baixar
        </button>
      ) : null,
    },
  ];

  function submitSettlement() {
    if (!settlement) return;
    const input = {
      id: settlement.id,
      paymentMethod: settlementForm.paymentMethod || undefined,
      notes: settlementForm.notes || undefined,
    };
    if (settlement.kind === 'ar') markArPaid.mutate(input);
    else markApPaid.mutate(input);
  }

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-8 overflow-auto p-4 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <H1>Financeiro</H1>
          <Subtitle>Receber, pagar e fluxo de caixa em uma operação única</Subtitle>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDrawer('ar')}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground"
          >
            <Plus size={15} />
            Lançar recebível
          </button>
          <button
            type="button"
            onClick={() => setDrawer('ap')}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs font-semibold text-foreground"
          >
            <Plus size={15} />
            Lançar pagamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryTile label="A receber" value={summaryQuery.data?.totalReceivableCents ?? 0} icon={Receipt} tone="success" />
        <SummaryTile label="A pagar" value={summaryQuery.data?.totalPayableCents ?? 0} icon={CreditCard} tone="destructive" />
        <SummaryTile label="Vencidos" value={summaryQuery.data?.overdueCents ?? 0} icon={TrendingUp} tone="warning" />
        <SummaryTile label="Resultado mensal" value={summaryQuery.data?.monthFlowCents ?? 0} icon={Landmark} tone="primary" />
      </div>

      <div className="inline-flex w-fit rounded-2xl border border-border bg-card p-1">
        {[
          { id: 'receber', label: 'Receber', icon: ArrowUpRight },
          { id: 'pagar', label: 'Pagar', icon: ArrowDownRight },
          { id: 'fluxo', label: 'Fluxo de Caixa', icon: Landmark },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as FinanceTab)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground',
              tab === id && 'bg-muted text-foreground',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'receber' ? (
        <section className="space-y-4">
          <select
            value={arStatus ?? ''}
            onChange={(event) => setArStatus((event.target.value as FinancialStatus | '') || undefined)}
            className="input-field w-full sm:w-56"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Vencidos</option>
            <option value="paid">Pagos</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <DataTable<ArRow>
            columns={arColumns}
            data={arRows}
            rowKey={(row) => row.ar.id}
            loading={arQuery.isLoading}
            emptyMessage="Nenhum recebível encontrado."
            emptyAction={
              <button type="button" onClick={() => setDrawer('ar')} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Lançar recebível
              </button>
            }
          />
        </section>
      ) : null}

      {tab === 'pagar' ? (
        <section className="space-y-4">
          <select
            value={apStatus ?? ''}
            onChange={(event) => setApStatus((event.target.value as FinancialStatus | '') || undefined)}
            className="input-field w-full sm:w-56"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Vencidos</option>
            <option value="paid">Pagos</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <DataTable<ApRow>
            columns={apColumns}
            data={apRows}
            rowKey={(row) => row.id}
            loading={apQuery.isLoading}
            emptyMessage="Nenhuma conta a pagar encontrada."
            emptyAction={
              <button type="button" onClick={() => setDrawer('ap')} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Lançar pagamento
              </button>
            }
          />
        </section>
      ) : null}

      {tab === 'fluxo' ? (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <RevenueLineChart
            title="Fluxo de caixa realizado"
            data={cashFlowData}
            loading={cashFlowQuery.isLoading}
            valueFormatter={(value) => formatBRL(Number(value))}
          />
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projeção</p>
            <div className="mt-5 space-y-4">
              <div>
                <Muted>Entradas pendentes</Muted>
                <p className="font-tabular text-2xl font-semibold text-success">
                  {formatBRL(cashFlowQuery.data?.projection.pendingCredits ?? 0)}
                </p>
              </div>
              <div>
                <Muted>Saídas pendentes</Muted>
                <p className="font-tabular text-2xl font-semibold text-destructive">
                  {formatBRL(cashFlowQuery.data?.projection.pendingDebits ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <Drawer title="Lançar recebível" open={drawer === 'ar'} onClose={() => setDrawer(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cliente</span>
            <select
              value={arForm.clientId}
              onChange={(event) => setArForm((form) => ({ ...form, clientId: event.target.value }))}
              className="input-field"
            >
              <option value="">Selecione</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}{client.clinic ? ` - ${client.clinic}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">ID do trabalho</span>
            <input
              type="number"
              min="1"
              value={arForm.jobId}
              onChange={(event) => setArForm((form) => ({ ...form, jobId: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Valor</span>
            <CurrencyInput
              value={arForm.amountCents}
              onChange={(amountCents) => setArForm((form) => ({ ...form, amountCents }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Vencimento</span>
            <input
              type="date"
              value={arForm.dueDate}
              onChange={(event) => setArForm((form) => ({ ...form, dueDate: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Descrição</span>
            <textarea
              value={arForm.description}
              onChange={(event) => setArForm((form) => ({ ...form, description: event.target.value }))}
              className="input-field min-h-24 resize-none"
            />
          </label>
          <button
            type="button"
            disabled={!arForm.clientId || !arForm.jobId || arForm.amountCents <= 0 || !arForm.dueDate || createAr.isPending}
            onClick={() => createAr.mutate({
              clientId: Number(arForm.clientId),
              jobId: Number(arForm.jobId),
              amountCents: arForm.amountCents,
              dueDate: dateInputToIso(arForm.dueDate),
              description: arForm.description || undefined,
            })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {createAr.isPending ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Salvar recebível
          </button>
        </div>
      </Drawer>

      <Drawer title="Lançar conta a pagar" open={drawer === 'ap'} onClose={() => setDrawer(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Descrição</span>
            <input
              value={apForm.description}
              onChange={(event) => setApForm((form) => ({ ...form, description: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Fornecedor</span>
            <input
              value={apForm.supplier}
              onChange={(event) => setApForm((form) => ({ ...form, supplier: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Categoria</span>
            <input
              value={apForm.category}
              onChange={(event) => setApForm((form) => ({ ...form, category: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Valor</span>
            <CurrencyInput
              value={apForm.amountCents}
              onChange={(amountCents) => setApForm((form) => ({ ...form, amountCents }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Vencimento</span>
            <input
              type="date"
              value={apForm.dueDate}
              onChange={(event) => setApForm((form) => ({ ...form, dueDate: event.target.value }))}
              className="input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Notas</span>
            <textarea
              value={apForm.notes}
              onChange={(event) => setApForm((form) => ({ ...form, notes: event.target.value }))}
              className="input-field min-h-24 resize-none"
            />
          </label>
          <button
            type="button"
            disabled={!apForm.description.trim() || apForm.amountCents <= 0 || !apForm.dueDate || createAp.isPending}
            onClick={() => createAp.mutate({
              description: apForm.description,
              amountCents: apForm.amountCents,
              dueDate: dateInputToIso(apForm.dueDate),
              supplier: apForm.supplier || undefined,
              category: apForm.category || undefined,
              notes: apForm.notes || undefined,
            })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {createAp.isPending ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Salvar pagamento
          </button>
        </div>
      </Drawer>

      <Drawer title={`Baixa financeira - ${settlement?.label ?? ''}`} open={Boolean(settlement)} onClose={() => setSettlement(null)}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Método</span>
            <select
              value={settlementForm.paymentMethod}
              onChange={(event) => setSettlementForm((form) => ({ ...form, paymentMethod: event.target.value }))}
              className="input-field"
            >
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Observações</span>
            <textarea
              value={settlementForm.notes}
              onChange={(event) => setSettlementForm((form) => ({ ...form, notes: event.target.value }))}
              className="input-field min-h-28 resize-none"
            />
          </label>
          <button
            type="button"
            onClick={submitSettlement}
            disabled={markArPaid.isPending || markApPaid.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {markArPaid.isPending || markApPaid.isPending ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Confirmar baixa
          </button>
        </div>
      </Drawer>
    </PageTransition>
  );
}
