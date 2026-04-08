import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Lock,
  FileDown,
  Pencil,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function PayrollDetailPage() {
  const { id } = useParams();
  const periodId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [bonusValue, setBonusValue] = useState(0);
  const [notes, setNotes] = useState('');
  const [downloadingEmployeeId, setDownloadingEmployeeId] = useState<number | null>(null);

  const { data: periodReport, isLoading: isLoadingPeriod } = trpc.payroll.getPeriodReport.useQuery({
    periodId,
  });
  const period = periodReport?.period;
  const entries = periodReport?.entries ?? [];

  const generateMutation = trpc.payroll.generateEntries.useMutation({
    onSuccess: () => {
      utils.payroll.getPeriodReport.invalidate({ periodId });
    },
  });

  const updateEntryMutation = trpc.payroll.updateEntry.useMutation({
    onSuccess: () => {
      utils.payroll.getPeriodReport.invalidate({ periodId });
      setEditingEntryId(null);
    },
  });

  const closeMutation = trpc.payroll.closePeriod.useMutation({
    onSuccess: () => {
      utils.payroll.getPeriodReport.invalidate({ periodId });
      utils.payroll.listPeriods.invalidate();
    },
  });

  async function handleDownloadPayslip(employeeId: number) {
    setDownloadingEmployeeId(employeeId);
    try {
      const payload = await utils.payroll.generatePayslip.fetch({ periodId, employeeId });
      const maybeBuffer = payload as { data?: number[] };
      const bytes = maybeBuffer.data ? new Uint8Array(maybeBuffer.data) : new Uint8Array();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `holerite-${period?.month}-${period?.year}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadingEmployeeId(null);
    }
  }

  const handleUpdate = (entryId: number) => {
    updateEntryMutation.mutate({
      entryId,
      discountsCents: discountValue,
      bonusCents: bonusValue,
      notes,
    });
  };

  const getMonthName = (m: number) => {
    return new Date(2000, m - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };

  if (isLoadingPeriod)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  if (!period) return <div className="p-6">Período não encontrado.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payroll')}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">
              {getMonthName(period.month)} {period.year}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  period.status === 'closed'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-orange-500/10 text-orange-500'
                }`}
              >
                {period.status === 'closed' ? 'Fechado' : 'Aberto'}
              </span>
              <span className="text-xs text-zinc-500 border-l border-zinc-800 pl-2">
                Ref: {period.id}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {period.status === 'open' && (
            <>
              <button
                onClick={() => generateMutation.mutate({ periodId })}
                disabled={generateMutation.isPending}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-zinc-700"
              >
                {generateMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Consolidar Valores
              </button>
              <button
                onClick={() => {
                  if (
                    confirm('Deseja fechar esta folha? Não será mais possível editar lançamentos.')
                  )
                    closeMutation.mutate({ periodId });
                }}
                disabled={closeMutation.isPending}
                className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20"
              >
                {closeMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Lock size={16} />
                )}
                Fechar Folha
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Total Bruto</p>
          <p className="text-2xl font-bold text-white">
            R${' '}
            {((period.totalGrossCents || 0) / 100).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Total Descontos</p>
          <p className="text-2xl font-bold text-red-400">
            R${' '}
            {((period.totalDiscountsCents || 0) / 100).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl ring-1 ring-emerald-500/20">
          <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Total Líquido</p>
          <p className="text-2xl font-bold text-emerald-400">
            R${' '}
            {((period.totalNetCents || 0) / 100).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Funcionário
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Salário + Comissões
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Bônus
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Descontos
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Líquido
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-[120px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoadingPeriod ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-zinc-600" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-zinc-500">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                    <p>Nenhum lançamento gerado.</p>
                    <button
                      onClick={() => generateMutation.mutate({ periodId })}
                      className="text-primary text-sm mt-2 hover:underline"
                    >
                      Consolidar agora
                    </button>
                  </td>
                </tr>
              ) : (
                entries.map((entry: (typeof entries)[number]) => (
                  <tr key={entry.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold ring-1 ring-zinc-700">
                          {entry.employeeName?.charAt(0)}
                        </div>
                        <div className="text-sm font-medium text-zinc-200">
                          {entry.employeeName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-zinc-400">
                        R${' '}
                        {((entry.baseSalaryCents + entry.commissionsCents) / 100).toLocaleString(
                          'pt-BR',
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingEntryId === entry.id ? (
                        <input
                          type="number"
                          className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-emerald-400"
                          value={bonusValue}
                          onChange={(e) => setBonusValue(Number(e.target.value))}
                        />
                      ) : (
                        <div className="text-xs text-emerald-500 font-medium">
                          + R$ {(0).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingEntryId === entry.id ? (
                        <input
                          type="number"
                          className="w-20 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-red-400"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(Number(e.target.value))}
                        />
                      ) : (
                        <div className="text-xs text-red-400 font-medium">
                          - R$ {(0).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-white font-mono">
                        R${' '}
                        {(entry.netCents / 100).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex gap-2 justify-end">
                      {period.status === 'open' &&
                        (editingEntryId === entry.id ? (
                          <button
                            onClick={() => handleUpdate(entry.id)}
                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingEntryId(entry.id);
                              setDiscountValue(0);
                              setBonusValue(0);
                              setNotes(entry.notes || '');
                            }}
                            className="p-2 text-zinc-500 hover:text-white"
                          >
                            <Pencil size={16} />
                          </button>
                        ))}
                      <button
                        onClick={() => {
                          void handleDownloadPayslip(entry.employeeId);
                        }}
                        className="p-2 text-primary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Baixar Holerite PDF"
                      >
                        {downloadingEmployeeId === entry.employeeId ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <FileDown size={16} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
