import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { TicketList } from '../../../components/support/ticket-list';
import { TicketDetail } from '../../../components/support/ticket-detail';
import { TicketForm } from '../../../components/support/ticket-form';

export default function TicketsPage() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<
    'open' | 'in_progress' | 'resolved' | 'closed' | ''
  >('');
  const [priorityFilter, setPriorityFilter] = useState<'low' | 'medium' | 'high' | 'urgent' | ''>(
    '',
  );
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const ticketsQuery = trpc.support.listTickets.useQuery({
    limit: 20,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
  });

  const ticketQuery = trpc.support.getTicket.useQuery(
    { ticketId: selectedTicketId ?? 0 },
    { enabled: Boolean(selectedTicketId) },
  );

  const createTicketMutation = trpc.support.createTicket.useMutation();
  const updateTicketMutation = trpc.support.updateTicket.useMutation();
  const addMessageMutation = trpc.support.addTicketMessage.useMutation();

  const tickets = useMemo(() => ticketsQuery.data?.data ?? [], [ticketsQuery.data?.data]);
  const busy =
    createTicketMutation.isPending ||
    updateTicketMutation.isPending ||
    addMessageMutation.isPending;

  async function refreshTicketData(ticketId?: number) {
    await utils.support.listTickets.invalidate();
    if (ticketId) {
      await utils.support.getTicket.invalidate({ ticketId });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Suporte • Tickets</h1>
        <p className="text-sm text-zinc-400">
          Central de atendimento interno com fluxo de tickets escalados.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Status (todos)</option>
          <option value="open">Abertos</option>
          <option value="in_progress">Em andamento</option>
          <option value="resolved">Resolvidos</option>
          <option value="closed">Fechados</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
          className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Prioridade (todas)</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1 space-y-4">
          <TicketForm
            busy={busy}
            onSubmit={async (payload) => {
              const created = await createTicketMutation.mutateAsync(payload);
              setSelectedTicketId(created.id);
              await refreshTicketData(created.id);
            }}
          />

          <TicketList
            tickets={tickets}
            selectedTicketId={selectedTicketId}
            onSelect={setSelectedTicketId}
          />
        </div>

        <div className="xl:col-span-3">
          <TicketDetail
            ticket={ticketQuery.data?.ticket ?? null}
            messages={ticketQuery.data?.messages ?? []}
            busy={busy}
            onUpdate={async (payload) => {
              if (!selectedTicketId) return;
              await updateTicketMutation.mutateAsync({
                ticketId: selectedTicketId,
                ...payload,
              });
              await refreshTicketData(selectedTicketId);
            }}
            onAddMessage={async (payload) => {
              if (!selectedTicketId) return;
              await addMessageMutation.mutateAsync({
                ticketId: selectedTicketId,
                ...payload,
              });
              await refreshTicketData(selectedTicketId);
            }}
          />
        </div>
      </div>
    </div>
  );
}
