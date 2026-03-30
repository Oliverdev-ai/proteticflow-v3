import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { Truck, Plus, Calendar, ChevronRight } from 'lucide-react';

function getWeekDays() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function DeliveryListPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const weekDays = getWeekDays();
  const startOfWeek = weekDays[0]!;
  const endOfWeek = weekDays[6]!;
  endOfWeek.setHours(23, 59, 59);

  const { data, isLoading, error } = trpc.delivery.listSchedules.useQuery({
    dateFrom: startOfWeek.toISOString(),
    dateTo: endOfWeek.toISOString(),
    page: 1, limit: 100,
  });

  const schedules = data?.data ?? [];

  // Map schedules by date (YYYY-MM-DD)
  const byDay: Record<string, typeof schedules> = {};
  for (const s of schedules) {
    const key = new Date(s.date).toISOString().split('T')[0]!;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(s);
  }

  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="text-violet-500" size={24} />
            Roteiros de Entrega
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Calendario semanal dos roteiros</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Novo Roteiro
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
          Erro ao carregar roteiros: {error.message}
        </div>
      )}
      {isLoading && (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Carregando roteiros da semana...
        </div>
      )}
      {!isLoading && schedules.length === 0 && (
        <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Nenhum roteiro cadastrado nesta semana.
        </div>
      )}

      {/* Week header */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-neutral-800">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div key={i} className={`p-3 text-center border-r border-neutral-800 last:border-r-0 ${isToday ? 'bg-violet-900/20' : ''}`}>
                <p className="text-xs text-neutral-500">{dayLabels[i]}</p>
                <p className={`text-lg font-semibold ${isToday ? 'text-violet-400' : 'text-white'}`}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Schedule cards per day */}
        <div className="grid grid-cols-7 min-h-48">
          {weekDays.map((day, i) => {
            const key = day.toISOString().split('T')[0]!;
            const daySchedules = byDay[key] ?? [];
            return (
              <div key={i} className="p-2 border-r border-neutral-800 last:border-r-0 space-y-2">
                {daySchedules.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-neutral-700">Sem roteiros</p>
                  </div>
                )}
                {daySchedules.map(s => {
                  const itemCount = (s as Record<string, unknown>).itemCount as number ?? 0;
                  return (
                    <Link
                      key={s.id}
                      to={`/entregas/${s.id}`}
                      className="block p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white font-medium truncate">{s.driverName ?? 'Sem motorista'}</span>
                        <ChevronRight size={12} className="text-neutral-500 group-hover:text-neutral-300" />
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{itemCount} {itemCount === 1 ? 'OS' : 'OSs'}</p>
                      {s.vehicle && <p className="text-xs text-neutral-600">{s.vehicle}</p>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Schedule modal placeholder */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-violet-400" /> Novo Roteiro de Entrega
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Data do roteiro</label>
                <input type="date" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Motorista (opcional)</label>
                <input type="text" placeholder="Nome do motorista" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-600" />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Veiculo (opcional)</label>
                <input type="text" placeholder="Placa ou modelo" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-600" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setCreateOpen(false)} className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 text-sm transition-colors">Cancelar</button>
                <button className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">Criar Roteiro</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
