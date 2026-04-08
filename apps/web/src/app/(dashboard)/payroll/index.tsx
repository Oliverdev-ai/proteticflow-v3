import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { Plus, Calendar, ChevronRight, CheckCircle2, Clock, Loader2 } from 'lucide-react';

export default function PayrollIndex() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [isCreating, setIsCreating] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  const { data: periods, isLoading } = trpc.payroll.listPeriods.useQuery();

  const createMutation = trpc.payroll.createPeriod.useMutation({
    onSuccess: (period) => {
      if (!period) return;
      utils.payroll.listPeriods.invalidate();
      setIsCreating(false);
      navigate(`/payroll/${period.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({ month: newMonth, year: newYear });
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Folha de Pagamento</h1>
          <p className="text-zinc-400 text-sm">Gerencie os períodos de fechamento e holerites.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Novo Período
        </button>
      </div>

      {isCreating && (
        <div className="bg-zinc-900 border border-primary/30 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-sm font-semibold text-white">Abrir Novo Período</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Mês</label>
              <select
                className="input-field w-full"
                value={newMonth}
                onChange={(e) => setNewMonth(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Ano</label>
              <input
                type="number"
                className="input-field w-full"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-primary hover:bg-primary text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            >
              {createMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                'Confirmar Abertura'
              )}
            </button>
          </div>
          {createMutation.error && (
            <p className="text-red-400 text-xs text-center">{createMutation.error.message}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 py-20 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : periods?.length === 0 ? (
          <div className="col-span-2 py-20 text-center bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
            <Calendar size={48} className="text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium">Nenhum período de folha encontrado.</p>
            <p className="text-zinc-600 text-sm">
              Clique em "Novo Período" para iniciar o fechamento.
            </p>
          </div>
        ) : (
          periods?.map((period) => (
            <div
              key={period.id}
              onClick={() => navigate(`/payroll/${period.id}`)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-primary/50 hover:bg-zinc-800/50 transition-all group relative overflow-hidden"
            >
              <div
                className={`absolute top-0 right-0 w-1.5 h-full ${period.status === 'closed' ? 'bg-emerald-500' : 'bg-orange-500'}`}
              />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 text-primary">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white capitalize">
                      {getMonthName(period.month)}
                    </h3>
                    <p className="text-xs text-zinc-500">{period.year}</p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    period.status === 'closed'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                  }`}
                >
                  {period.status === 'closed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {period.status === 'closed' ? 'Fechado' : 'Aberto'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">
                    Total Bruto
                  </p>
                  <p className="text-sm font-bold text-zinc-200">
                    R$ {((period.totalGrossCents || 0) / 100).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-tighter">
                    Total Líquido
                  </p>
                  <p className="text-sm font-bold text-emerald-400">
                    R$ {((period.totalNetCents || 0) / 100).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                  {period.closedAt
                    ? `Fechado em: ${new Date(period.closedAt).toLocaleDateString('pt-BR')}`
                    : 'Última mutação recente'}
                </span>
                <ChevronRight size={16} className="text-primary" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
