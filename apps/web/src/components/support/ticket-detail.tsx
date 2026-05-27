import { useState } from 'react';
import type { SupportTicket, TicketMessage } from '@proteticflow/shared';

type TicketDetailProps = {
  ticket: SupportTicket | null;
  messages: TicketMessage[];
  busy?: boolean;
  onUpdate: (payload: { status?: SupportTicket['status']; priority?: SupportTicket['priority'] }) => Promise<void>;
  onAddMessage: (payload: { content: string; isInternal: boolean }) => Promise<void>;
};

export function TicketDetail({ ticket, messages, busy, onUpdate, onAddMessage }: TicketDetailProps) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  if (!ticket) {
    return (
      <div className="rounded-lg border border-border bg-muted p-6">
        <p className="text-sm text-muted-foreground">Selecione um ticket para ver detalhes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg text-white font-semibold">{ticket.subject}</h3>
        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">#{ticket.id}</span>
      </div>

      <p className="text-sm text-muted-foreground">{ticket.description}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'in_progress' })} className="px-3 py-1.5 rounded text-xs bg-[var(--info-soft)] text-white disabled:opacity-50">Em andamento</button>
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'resolved' })} className="px-3 py-1.5 rounded text-xs bg-[var(--success-soft)] text-white disabled:opacity-50">Resolver</button>
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'closed' })} className="px-3 py-1.5 rounded text-xs bg-muted text-white disabled:opacity-50">Fechar</button>
      </div>

      <div className="space-y-2 max-h-[34vh] overflow-y-auto border border-border rounded-xl p-3 bg-muted">
        {messages.length === 0 ? <p className="text-xs text-muted-foreground">Sem mensagens.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className="border border-border rounded-lg px-3 py-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.content}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {message.isInternal ? 'Interna' : 'Cliente'} • {new Date(message.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Responder ticket..."
          className="w-full min-h-[90px] rounded-xl bg-muted border border-border text-muted-foreground text-sm px-3 py-2"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
          Mensagem interna (somente staff)
        </label>
        <button
          type="button"
          disabled={busy || content.trim().length === 0}
          onClick={async () => {
            await onAddMessage({ content: content.trim(), isInternal });
            setContent('');
            setIsInternal(false);
          }}
          className="px-4 py-2 rounded bg-primary hover:bg-primary text-white text-sm disabled:opacity-50"
        >
          Enviar mensagem
        </button>
      </div>
    </div>
  );
}
