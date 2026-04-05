import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { 
  Plus, 
  Search, 
  Mail, 
  ChevronRight,
  UserX,
  Users
} from 'lucide-react';

export default function FuncionariosIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Router is 'employee' (singular)
  const { data, isLoading } = trpc.employee.list.useQuery({
    search, 
    isActive: !showInactive 
  });

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Funcionários</h1>
          <p className="text-zinc-400 text-sm">Gerencie sua equipe, comissões e atribuições.</p>
        </div>
        <button 
          onClick={() => navigate('/funcionarios/novo')} 
          className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Novo Funcionário
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <button 
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
            showInactive 
              ? 'bg-zinc-800 border-zinc-700 text-zinc-200' 
              : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <UserX size={16} />
          {showInactive ? 'Ver Ativos' : 'Ver Inativos'}
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50">
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Funcionário</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo / Contrato</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Salário Base</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Comissão (%)</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <span className="text-sm">Carregando funcionários...</span>
                    </div>
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                       <Users size={32} className="text-zinc-700 mb-2" />
                       <span className="text-sm font-medium">Nenhum funcionário encontrado</span>
                       <span className="text-xs">Tente ajustar seus filtros de busca</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.data.map((emp: typeof data.data[number]) => (
                  <tr 
                    key={emp.id} 
                    className="group cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => navigate(`/funcionarios/${emp.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-zinc-100 group-hover:text-primary transition-colors">{emp.name}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Mail size={12} /> {emp.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-300 capitalize">{emp.type}</span>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tight">{emp.contractType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                      R$ {((emp.baseSalaryCents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-sm text-zinc-300 bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700">
                         {emp.defaultCommissionPercent}%
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        emp.isActive 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-zinc-700/50 text-zinc-500 border border-zinc-700'
                      }`}>
                        {emp.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
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
