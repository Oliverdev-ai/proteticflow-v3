import { useState } from 'react';
import { Activity, Loader2, Plus } from 'lucide-react';
import { JOB_STATUS_LABELS, type JobStatus } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { cn } from '../../lib/utils';

type TimelineEvent = {
  id: number;
  tipo: 'STATUS_CHANGE' | 'NOTA' | 'ARQUIVO' | 'ENTREGA';
  descricao: string;
  fromStatus: string | null;
  toStatus: string;
  criadoEm: string | Date;
  usuarioNome: string;
};

function eventLabel(event: TimelineEvent) {
  if (event.tipo === 'NOTA') return 'Nota';
  if (event.tipo === 'ARQUIVO') return 'Arquivo';
  if (event.tipo === 'ENTREGA') return 'Entrega';
  return 'Status';
}

export function TrabalhoTimeline({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const [note, setNote] = useState('');
  const timelineQuery = trpc.job.listTimeline.useInfiniteQuery(
    { jobId, limit: 50 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const addNote = trpc.job.addNote.useMutation({
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        utils.job.listTimeline.invalidate({ jobId }),
        utils.job.get.invalidate({ id: jobId }),
      ]);
    },
  });

  const events = timelineQuery.data?.pages.flatMap((page) => page.items as TimelineEvent[]) ?? [];

  return (
    <div className="space-y-6">
      <form
        className="rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) return;
          addNote.mutate({ jobId, text: note.trim() });
        }}
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nova anotação
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="input-field mt-2 w-full resize-none"
          placeholder="Registre uma observação operacional..."
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={!note.trim() || addNote.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {addNote.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            Salvar nota
          </button>
        </div>
      </form>

      {timelineQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum evento registrado.
        </div>
      ) : (
        <div className="relative space-y-4 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-border">
          {events.map((event) => (
            <div key={event.id} className="relative flex gap-4">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary">
                <Activity size={16} />
              </div>
              <div className="flex-1 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {eventLabel(event)}
                    </span>
                    {event.toStatus ? (
                      <span className="text-xs font-semibold text-primary">
                        {JOB_STATUS_LABELS[event.toStatus as JobStatus] ?? event.toStatus}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-tabular text-xs text-muted-foreground">
                    {new Date(event.criadoEm).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className={cn('mt-3 text-sm text-foreground', event.tipo === 'NOTA' && 'italic')}>
                  {event.descricao}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{event.usuarioNome}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {timelineQuery.hasNextPage ? (
        <button
          type="button"
          disabled={timelineQuery.isFetchingNextPage}
          onClick={() => void timelineQuery.fetchNextPage()}
          className="w-full rounded-xl border border-border px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {timelineQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar eventos anteriores'}
        </button>
      ) : null}
    </div>
  );
}
