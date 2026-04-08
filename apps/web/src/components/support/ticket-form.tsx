import { useState } from 'react';

type TicketFormProps = {
  busy?: boolean;
  onSubmit: (payload: { subject: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent' }) => Promise<void>;
};

export function TicketForm({ busy, onSubmit }: TicketFormProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-white">Novo ticket</h2>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Assunto"
        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descrição do problema"
        className="w-full min-h-[90px] rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
      />
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | 'urgent')}
        className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
      >
        <option value="low">Baixa</option>
        <option value="medium">Média</option>
        <option value="high">Alta</option>
        <option value="urgent">Urgente</option>
      </select>
      <button
        type="button"
        disabled={busy || subject.trim().length === 0 || description.trim().length === 0}
        onClick={async () => {
          await onSubmit({ subject: subject.trim(), description: description.trim(), priority });
          setSubject('');
          setDescription('');
          setPriority('medium');
        }}
        className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm disabled:opacity-50"
      >
        Criar ticket
      </button>
    </div>
  );
}
