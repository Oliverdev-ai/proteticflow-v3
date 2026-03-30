import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { MembersTab } from './membros';

type TabKey = 'logs' | 'usage' | 'members';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'logs', label: 'Logs de Auditoria' },
  { key: 'usage', label: 'Uso do Tenant' },
  { key: 'members', label: 'Membros' },
];

const PAGE_SIZE = 20;

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
      await Promise.all([
        utils.audit.members.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
  });
  const unblockMemberMutation = trpc.audit.unblockMember.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.audit.members.invalidate(),
        utils.audit.list.invalidate(),
      ]);
    },
  });

  const memberByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const member of membersQuery.data ?? []) {
      map.set(member.userId, member.name);
    }
    return map;
  }, [membersQuery.data]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Auditoria</h1>
        <p className="text-sm text-neutral-400">
          Rastreabilidade de operacoes, uso do plano e controle de bloqueio de membros.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm border ${
              activeTab === tab.key
                ? 'bg-blue-700 border-blue-600 text-white'
                : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'logs' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={entityType}
              onChange={(event) => {
                setPage(1);
                setEntityType(event.target.value);
              }}
              className="input-field"
              placeholder="Filtro entidade (ex: jobs)"
            />
            <input
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              className="input-field"
              placeholder="Filtro acao (ex: job.create)"
            />
            <input
              value={userIdInput}
              onChange={(event) => {
                setPage(1);
                setUserIdInput(event.target.value);
              }}
              className="input-field"
              placeholder="Filtro userId"
            />
          </div>

          {logsQuery.isLoading ? (
            <p className="text-sm text-neutral-400">Carregando logs...</p>
          ) : logsQuery.error ? (
            <p className="text-sm text-red-400">Erro ao carregar logs: {logsQuery.error.message}</p>
          ) : (logsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum log encontrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900 text-neutral-400">
                    <tr>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Usuario</th>
                      <th className="text-left px-3 py-2">Acao</th>
                      <th className="text-left px-3 py-2">Entidade</th>
                      <th className="text-left px-3 py-2">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsQuery.data?.items.map((item) => (
                      <tr key={item.id} className="border-t border-neutral-800">
                        <td className="px-3 py-2 text-neutral-300">
                          {new Date(item.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-neutral-100">
                          {memberByUserId.get(item.userId) ?? `#${item.userId}`}
                        </td>
                        <td className="px-3 py-2 text-neutral-100">{item.action}</td>
                        <td className="px-3 py-2 text-neutral-300">{item.entityType}</td>
                        <td className="px-3 py-2 text-neutral-300">{item.entityId ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">
                  Pagina {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={!canPrev}
                    className="px-3 py-1.5 rounded-md border border-neutral-700 text-neutral-200 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={!canNext}
                    className="px-3 py-1.5 rounded-md border border-neutral-700 text-neutral-200 disabled:opacity-50"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeTab === 'usage' ? (
        <div className="space-y-4">
          {usageQuery.isLoading ? <p className="text-sm text-neutral-400">Carregando uso...</p> : null}
          {usageQuery.error ? <p className="text-sm text-red-400">{usageQuery.error.message}</p> : null}
          {!usageQuery.isLoading && !usageQuery.error && !usageQuery.data ? (
            <p className="text-sm text-neutral-400">Nao foi possivel obter o sumario de uso.</p>
          ) : null}
          {usageQuery.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <UsageCard label="Plano" used={usageQuery.data.plan} limit={null} />
              <UsageCard label="Clientes" used={usageQuery.data.clients.used} limit={usageQuery.data.clients.limit} />
              <UsageCard label="Jobs no mes" used={usageQuery.data.jobsThisMonth.used} limit={usageQuery.data.jobsThisMonth.limit} />
              <UsageCard label="Usuarios" used={usageQuery.data.users.used} limit={usageQuery.data.users.limit} />
              <UsageCard label="Tabelas de preco" used={usageQuery.data.priceTables.used} limit={usageQuery.data.priceTables.limit} />
              <UsageCard label="Storage (MB)" used={usageQuery.data.storageMb.used} limit={usageQuery.data.storageMb.limit} />
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
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-1">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      {typeof used === 'number' ? (
        <p className="text-lg font-semibold text-white">
          {used}
          {limit !== null ? <span className="text-sm text-neutral-400"> / {limit}</span> : null}
        </p>
      ) : (
        <p className="text-lg font-semibold text-white">{used}</p>
      )}
      {typeof used === 'number' && limit !== null && limit > 0 ? (
        <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-blue-600"
            style={{ width: `${Math.min(100, Math.round((used / limit) * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
