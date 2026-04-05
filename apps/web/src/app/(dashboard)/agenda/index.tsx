import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, closestCenter, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CalendarDays, Plus } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { EVENT_TYPE_COLORS } from '@proteticflow/shared';

type ViewMode = 'week' | 'month';

type EventRow = {
  event: {
    id: number;
    title: string;
    type: string;
    startAt: string | Date;
    endAt: string | Date;
    employeeId: number | null;
    clientId: number | null;
    jobId: number | null;
    isCancelled: boolean;
  };
  clientName: string | null;
  employeeName: string | null;
  jobCode: string | null;
};

function startOfWeek(base: Date): Date {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}

function endOfWeek(base: Date): Date {
  const start = startOfWeek(base);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function monthRange(base: Date): { from: Date; to: Date } {
  const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  const from = startOfWeek(firstDay);
  const to = endOfWeek(lastDay);
  return { from, to };
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildVisibleDays(current: Date, mode: ViewMode): Date[] {
  if (mode === 'week') {
    const start = startOfWeek(current);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  const { from } = monthRange(current);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return d;
  });
}

function EventCard({ row, dragging = false }: { row: EventRow; dragging?: boolean }) {
  const event = row.event;
  const start = new Date(event.startAt);
  const color = EVENT_TYPE_COLORS[event.type] ?? '#64748b';

  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-xs border text-white ${dragging ? 'opacity-70' : ''}`}
      style={{ backgroundColor: `${color}30`, borderColor: `${color}80` }}
    >
      <p className="font-medium truncate">{event.title} {row.jobCode ? `#${row.jobCode}` : ''}</p>
      <p className="text-[11px] text-zinc-200 truncate">
        {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {row.clientName ?? '-'}
      </p>
      <p className="text-[11px] text-zinc-300 truncate">{row.employeeName ?? 'Sem responsavel'}</p>
    </div>
  );
}

function DraggableEvent({ row }: { row: EventRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.event.id,
    data: { row },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ touchAction: 'none' }}>
      <EventCard row={row} dragging={isDragging} />
    </div>
  );
}

function DayCell({
  day,
  rows,
  isCurrentMonth,
}: {
  day: Date;
  rows: EventRow[];
  isCurrentMonth: boolean;
}) {
  const key = toDateKey(day);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  return (
    <div
      ref={setNodeRef}
      className={`border border-zinc-800 rounded-lg p-2 min-h-28 space-y-1 ${isCurrentMonth ? 'bg-zinc-900/50' : 'bg-zinc-950/60'} ${isOver ? 'ring-1 ring-primary' : ''}`}
    >
      <div className="text-xs text-zinc-500">{day.getDate()}</div>
      {rows.map((row) => (
        <DraggableEvent key={row.event.id} row={row} />
      ))}
    </div>
  );
}

export default function AgendaPage() {
  const [mode, setMode] = useState<ViewMode>('week');
  const [current, setCurrent] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [activeRow, setActiveRow] = useState<EventRow | null>(null);
  const utils = trpc.useUtils();

  const range = useMemo(() => {
    if (mode === 'week') return { from: startOfWeek(current), to: endOfWeek(current) };
    return monthRange(current);
  }, [mode, current]);

  const listQuery = trpc.agenda.list.useQuery({
    dateFrom: range.from.toISOString(),
    dateTo: range.to.toISOString(),
    type: typeFilter ? (typeFilter as 'prova' | 'entrega' | 'retirada' | 'reuniao' | 'manutencao' | 'outro') : undefined,
    employeeId: employeeFilter ? Number(employeeFilter) : undefined,
    clientId: clientFilter ? Number(clientFilter) : undefined,
  });

  const moveMutation = trpc.agenda.move.useMutation({
    onSuccess: async () => {
      await utils.agenda.list.invalidate();
    },
  });

  const rowsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const row of (listQuery.data ?? []) as EventRow[]) {
      const key = toDateKey(new Date(row.event.startAt));
      const currentRows = map.get(key) ?? [];
      currentRows.push(row);
      map.set(key, currentRows);
    }
    return map;
  }, [listQuery.data]);

  const visibleDays = useMemo(() => buildVisibleDays(current, mode), [current, mode]);

  function goPrev() {
    const next = new Date(current);
    if (mode === 'week') next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrent(next);
  }

  function goNext() {
    const next = new Date(current);
    if (mode === 'week') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrent(next);
  }

  function onDragStart(event: DragStartEvent) {
    const row = event.active.data.current?.row as EventRow | undefined;
    setActiveRow(row ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveRow(null);
    const overId = event.over?.id;
    const row = event.active.data.current?.row as EventRow | undefined;
    if (!row || !overId) return;

    const targetDate = new Date(`${String(overId)}T00:00:00`);
    const originalStart = new Date(row.event.startAt);
    targetDate.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);

    moveMutation.mutate({
      eventId: row.event.id,
      startAt: targetDate.toISOString(),
      endAt: new Date(row.event.endAt).toISOString(),
    });
  }

  const headerText = mode === 'week'
    ? `${range.from.toLocaleDateString('pt-BR')} - ${range.to.toLocaleDateString('pt-BR')}`
    : current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="text-primary" size={24} />
            Agenda
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Calendario semanal/mensal com drag-and-drop.</p>
        </div>
        <Link to="/agenda/novo" className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-medium">
          <Plus size={16} />
          Novo Evento
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={goPrev} className="px-3 py-2 bg-zinc-800 text-zinc-200 rounded-lg">Anterior</button>
        <button onClick={goNext} className="px-3 py-2 bg-zinc-800 text-zinc-200 rounded-lg">Proximo</button>
        <button onClick={() => setCurrent(new Date())} className="px-3 py-2 bg-zinc-800 text-zinc-200 rounded-lg">Hoje</button>
        <div className="text-sm text-zinc-300 mx-2">{headerText}</div>
        <button onClick={() => setMode('week')} className={`px-3 py-2 rounded-lg ${mode === 'week' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}>Semana</button>
        <button onClick={() => setMode('month')} className={`px-3 py-2 rounded-lg ${mode === 'month' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}>Mes</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-full">
          <option value="">Todos os tipos</option>
          <option value="prova">Prova</option>
          <option value="entrega">Entrega</option>
          <option value="retirada">Retirada</option>
          <option value="reuniao">Reuniao</option>
          <option value="manutencao">Manutencao</option>
          <option value="outro">Outro</option>
        </select>
        <input value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} type="number" placeholder="Filtrar por funcionario ID" className="input-field w-full" />
        <input value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} type="number" placeholder="Filtrar por cliente ID" className="input-field w-full" />
      </div>

      {listQuery.error && <p className="text-sm text-red-400">{listQuery.error.message}</p>}
      {listQuery.isLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          Carregando eventos da agenda...
        </div>
      )}
      {!listQuery.isLoading && !listQuery.error && (listQuery.data?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          Nenhum evento encontrado para o periodo e filtros selecionados.
        </div>
      )}
      {moveMutation.isPending && <p className="text-xs text-zinc-500">Atualizando evento...</p>}
      {moveMutation.error && <p className="text-xs text-red-400">Falha ao mover evento: {moveMutation.error.message}</p>}

      {!listQuery.isLoading && (
        <DndContext collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className={`grid gap-2 ${mode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-1 md:grid-cols-7'}`}>
            {visibleDays.map((day) => {
              const key = toDateKey(day);
              const rows = rowsByDay.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === current.getMonth();
              return <DayCell key={key} day={day} rows={rows} isCurrentMonth={isCurrentMonth} />;
            })}
          </div>

          <DragOverlay>
            {activeRow ? <EventCard row={activeRow} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

