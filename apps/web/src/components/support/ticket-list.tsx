import type { SupportTicket } from '@proteticflow/shared';

type TicketListProps = {
  tickets: SupportTicket[];
  selectedTicketId: number | null;
  onSelect: (ticketId: number) => void;
};

export function TicketList({ tickets, selectedTicketId, onSelect }: TicketListProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-white">Tickets</h2>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {tickets.length === 0 ? (
          <p className="text-xs text-zinc-500">Sem tickets no filtro atual.</p>
        ) : null}

        {tickets.map((ticket) => {
          const selected = selectedTicketId === ticket.id;
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onSelect(ticket.id)}
              className={`w-full text-left rounded-xl border px-3 py-2 ${
                selected ? 'border-primary bg-primary/10' : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              <p className="text-sm text-zinc-100 truncate">{ticket.subject}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                #{ticket.id} • {ticket.status} • {ticket.priority}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
