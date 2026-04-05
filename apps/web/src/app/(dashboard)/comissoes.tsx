import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { 
  Download, 
  FileText
} from 'lucide-react';

type CommissionDetail = {
  employeeId: number;
  employeeName: string;
  jobId: number;
  jobCode: string;
  task: string | null;
  jobTotalCents: number;
  commissionPercent: string;
  commissionAmountCents: number | null;
};

export default function CommissionsPage() {
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] ?? '');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [employeeId, setEmployeeId] = useState<number | undefined>(undefined);

  const { data: report, isLoading } = trpc.employee.commissionDetails.useQuery({
    dateFrom: new Date(dateFrom).toISOString(),
    dateTo: new Date(dateTo).toISOString(),
    employeeId
  });

  const { data: employees } = trpc.employee.list.useQuery({ isActive: true, page: 1, limit: 100 });

  const totalCommissions = (report as CommissionDetail[] | undefined)?.reduce((sum, item) => sum + (Number(item.commissionAmountCents) || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatório de Comissões</h1>
          <p className="text-zinc-400 text-sm">Acompanhe a produção técnica e valores a pagar.</p>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-zinc-700">
             <Download size={16} /> Exportar CSV
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Funcionário</label>
          <select 
            className="input-field w-full py-2 text-sm"
            onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Todos os Funcionários</option>
            {employees?.data.map((emp: typeof employees.data[number]) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">De</label>
          <input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field w-full py-2 text-sm" 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Até</label>
          <input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field w-full py-2 text-sm" 
          />
        </div>
        <div className="flex items-end text-right">
           <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-3">
              <div className="text-[10px] uppercase font-bold text-primary">Total Produzido</div>
              <div className="text-xl font-bold text-white">R$ {(totalCommissions / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
           </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50">
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Técnico</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">OS / Trabalho</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tarefa</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vl. Total</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Comissão (%)</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">A Receber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {isLoading ? (
               <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    <span className="text-sm text-zinc-500">Calculando comissões...</span>
                  </div>
                </td>
              </tr>
            ) : report?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-zinc-500">
                  <div className="flex flex-col items-center gap-2">
                     <FileText size={32} className="text-zinc-700 mb-2" />
                     <span className="text-sm">Nenhuma produção registrada neste período</span>
                  </div>
                </td>
              </tr>
            ) : (
              (report as CommissionDetail[]).map((item, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-zinc-200 group-hover:text-primary transition-colors">{item.employeeName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-zinc-300 font-mono">{item.jobCode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-zinc-400">{item.task || 'Geral'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-300 font-mono">
                    R$ {((item.jobTotalCents || 0) / 100).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-xs text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                        {item.commissionPercent}%
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-bold text-emerald-400">
                      R$ {((item.commissionAmountCents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
