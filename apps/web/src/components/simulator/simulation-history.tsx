type HistoryItem = {
  id: number;
  status: string;
  title: string | null;
  totalCents: number;
  convertedJobId: number | null;
  createdAt: string;
};

type SimulationHistoryProps = {
  items: HistoryItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function SimulationHistory({ items, selectedId, onSelect }: SimulationHistoryProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <h2 className="text-lg font-semibold text-white">Historico</h2>
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              selectedId === item.id
                ? 'border-primary bg-primary/10'
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-sm text-zinc-100">#{item.id} {item.title ?? 'Simulacao sem titulo'}</p>
            <p className="text-xs text-zinc-400 mt-1">Status: {item.status}</p>
            <p className="text-xs text-zinc-400">Total: R$ {(item.totalCents / 100).toFixed(2)}</p>
            <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
            {item.convertedJobId ? <p className="text-xs text-emerald-400">Convertida em OS #{item.convertedJobId}</p> : null}
          </button>
        ))}
        {items.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma simulacao registrada.</p> : null}
      </div>
    </div>
  );
}
