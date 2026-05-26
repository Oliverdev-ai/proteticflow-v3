import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { MembersTab } from './membros';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';
import { Button } from '../../../components/ui/button';

type TabKey = 'logs' | 'usage' | 'members';

type AuditRow = {
  id: number;
  createdAt: string;
  userId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValue: unknown;
  newValue: unknown;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'logs', label: 'Logs de auditoria' },
  { key: 'usage', label: 'Uso do tenant' },
  { key: 'members', label: 'Membros' },
];

const PAGE_SIZE = 20;

function hasDiff(entry: AuditRow): boolean {
  return entry.oldValue !== null || entry.newValue !== null;
}

function AuditDiffCell({ entry }: { entry: AuditRow }) {
  const [open, setOpen] = useState(false);
  const payload = JSON.stringify(
    {
      oldValue: entry.oldValue,
      newValue: entry.newValue,
    },
    null,
    2,
  );

  if (!hasDiff(entry)) {
    return <span className="t-small text-[var(--fg-muted)]">-</span>;
  }

  return (
    <>
      <button
        type="button"
        className="t-small text-[var(--primary)] underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        Ver diff
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar diff"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-lg)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-xl text-[var(--fg-strong)]">Diff do log #{entry.id}</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
            <pre className="h-[calc(100%-3rem)] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--fg)]">
              {payload}
            </pre>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export default function AuditPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<TabKey>('logs');
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [userIdInput, setUserIdInput] = useState('');

  const logsQuery = trpc.audit.list.useQuery({
    page,
    limit: PAGE_SIZE,
    entityType: entityType.trim() || undefined,
    action: action.trim() || undefined,
    userId: userIdInput.trim() ? Number(userIdInput) : undefined,
  });
  const usageQuery = trpc.audit.usageSummary.useQuery();
  const membersQuery = trpc.audit.members.useQuery();

  const blockMemberMutation = trpc.audit.blockMember.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.audit.members.invalidate(), utils.audit.list.invalidate()]);
    },
  });
  const unblockMemberMutation = trpc.audit.unblockMember.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.audit.members.invalidate(), utils.audit.list.invalidate()]);
    },
  });

  const memberByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.userId, member.name);
    }
    return map;
  }, [membersQuery.data]);

  const rows: AuditRow[] = (logsQuery.data?.items ?? []).map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    userId: item.userId,
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
    oldValue: item.oldValue,
    newValue: item.newValue,
  }));

  const columns: Column<AuditRow>[] = [
    {
      id: 'date',
      header: 'Data',
      width: '170px',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.createdAt).toLocaleString('pt-BR')}</span>,
    },
    {
      id: 'user',
      header: 'Usuario',
      width: '160px',
      cell: (row) => <span className="t-small">{memberByUserId.get(row.userId) ?? `#${row.userId}`}</span>,
    },
    {
      id: 'action',
      header: 'Acao',
      width: 'flex',
      cell: (row) => <span className="t-small">{row.action}</span>,
    },
    {
      id: 'entity',
      header: 'Entidade',
      width: '140px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.entityType}</span>,
    },
    {
      id: 'entityId',
      header: 'ID',
      width: '80px',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => <span className="t-mono text-[var(--fg-muted)]">{row.entityId ?? '-'}</span>,
    },
    {
      id: 'details',
      header: 'Detalhes',
      width: '100px',
      align: 'right',
      cell: (row) => <AuditDiffCell entry={row} />,
    },
  ];

  const totalPages = Math.max(1, Math.ceil((logsQuery.data?.total ?? 0) / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  async function handleBlock(userId: number, reason: string) {
    await blockMemberMutation.mutateAsync({ userId, reason });
  }

  async function handleUnblock(userId: number) {
    await unblockMemberMutation.mutateAsync({ userId });
  }

  return (
    <div className="space-y-4">
      <PageTitle subtitle="Rastreabilidade de operacoes, uso do plano e controle de bloqueio.">
        Auditoria
      </PageTitle>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'h-9 rounded-[var(--radius-md)] border border-[var(--primary)] bg-[var(--primary)] px-3 text-sm text-[var(--fg-on-primary)]'
                : 'h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'logs' ? (
        <div className="space-y-4">
          <FilterBar
            search={entityType}
            onSearchChange={(value) => {
              setPage(1);
              setEntityType(value);
            }}
            filters={(
              <>
                <input
                  value={action}
                  onChange={(event) => {
                    setPage(1);
                    setAction(event.target.value);
                  }}
                  className="h-9 min-w-[200px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  placeholder="Filtro acao"
                />
                <input
                  value={userIdInput}
                  onChange={(event) => {
                    setPage(1);
                    setUserIdInput(event.target.value);
                  }}
                  className="h-9 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  placeholder="Filtro userId"
                />
              </>
            )}
          />

          {logsQuery.error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar logs: {logsQuery.error.message}</p> : null}

          <DataTable
            columns={columns}
            rows={rows}
            getKey={(row) => row.id}
            loading={logsQuery.isLoading}
            loadingRows={8}
            empty={{
              title: 'Nenhum log encontrado',
              description: 'Ajuste os filtros para continuar.',
            }}
          />

          <div className="flex items-center justify-between">
            <p className="t-small text-[var(--fg-muted)]">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!canPrev}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!canNext}
              >
                Proxima
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'usage' ? (
        <div className="space-y-4">
          {usageQuery.isLoading ? <p className="t-small text-[var(--fg-muted)]">Carregando uso...</p> : null}
          {usageQuery.error ? <p className="t-small text-[var(--destructive)]">{usageQuery.error.message}</p> : null}
          {!usageQuery.isLoading && !usageQuery.error && !usageQuery.data ? (
            <p className="t-small text-[var(--fg-muted)]">Nao foi possivel obter o sumario de uso.</p>
          ) : null}
          {usageQuery.data ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <UsageCard label="Plano" used={usageQuery.data.plan} limit={null} />
              <UsageCard
                label="Clientes"
                used={usageQuery.data.clients.used}
                limit={usageQuery.data.clients.limit}
              />
              <UsageCard
                label="Jobs no mes"
                used={usageQuery.data.jobsThisMonth.used}
                limit={usageQuery.data.jobsThisMonth.limit}
              />
              <UsageCard
                label="Usuarios"
                used={usageQuery.data.users.used}
                limit={usageQuery.data.users.limit}
              />
              <UsageCard
                label="Tabelas de preco"
                used={usageQuery.data.priceTables.used}
                limit={usageQuery.data.priceTables.limit}
              />
              <UsageCard
                label="Storage (MB)"
                used={usageQuery.data.storageMb.used}
                limit={usageQuery.data.storageMb.limit}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'members' ? (
        <MembersTab
          members={membersQuery.data ?? []}
          isLoading={membersQuery.isLoading}
          error={membersQuery.error?.message ?? null}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          isMutating={blockMemberMutation.isPending || unblockMemberMutation.isPending}
        />
      ) : null}
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
}: {
  label: string;
  used: number | string;
  limit: number | null;
}) {
  const percentage = typeof used === 'number' && limit !== null && limit > 0
    ? Math.min(100, Math.round((used / limit) * 100))
    : null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-1">
      <p className="t-overline text-[var(--fg-muted)]">{label}</p>
      {typeof used === 'number' ? (
        <p className="text-lg font-semibold text-[var(--fg-strong)]">
          {used}
          {limit !== null ? <span className="text-sm text-[var(--fg-muted)]"> / {limit}</span> : null}
        </p>
      ) : (
        <p className="text-lg font-semibold text-[var(--fg-strong)]">{used}</p>
      )}

      {percentage !== null ? (
        <div className="h-2 w-full overflow-hidden rounded bg-[var(--bg-muted)]">
          <div
            className="h-full bg-[var(--primary)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : null}

      {percentage !== null ? (
        <StatusChip
          label={`${percentage}%`}
          variant={percentage >= 90 ? 'warning' : 'info'}
        />
      ) : null}
    </div>
  );
}
