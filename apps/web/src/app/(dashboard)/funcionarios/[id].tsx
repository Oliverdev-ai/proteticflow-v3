import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateEmployeeSchema } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { 
  ArrowLeft, Loader2, User, Briefcase,
  Pencil, Trash2, Award, History,
  Plus, X, Save, BarChart3, Clock3, Timer, Wallet
} from 'lucide-react';
import type { z } from 'zod';

type FormData = z.infer<typeof updateEmployeeSchema>;

function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTimeString(date: Date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : '--:--';
}

export default function EmployeeEditPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [clockDate, setClockDate] = useState(getLocalDateString());
  const [clockTime, setClockTime] = useState(getCurrentTimeString());
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const canLoadEmployeeContext = Number.isFinite(employeeId) && employeeId > 0;

  const { data: employee, isLoading: isLoadingEmp } = trpc.employee.get.useQuery({ id: employeeId });
  const { data: skills } = trpc.employee.listSkills.useQuery({ employeeId });
  const { data: assignments } = trpc.employee.listAssignments.useQuery({ employeeId });
  const { data: timesheets } = trpc.employee.timesheets.useQuery(
    { employeeId, month: currentMonth, year: currentYear },
    { enabled: canLoadEmployeeContext },
  );
  const { data: monthlySummary } = trpc.employee.monthlySummary.useQuery(
    { employeeId, month: currentMonth, year: currentYear },
    { enabled: canLoadEmployeeContext },
  );
  const { data: performance } = trpc.employee.performance.useQuery(
    { employeeId },
    { enabled: canLoadEmployeeContext },
  );

  const { register, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(updateEmployeeSchema),
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: () => {
      utils.employee.get.invalidate({ id: employeeId });
      setIsEditing(false);
    },
  });

  const dismissMutation = trpc.employee.dismiss.useMutation({
    onSuccess: () => {
      utils.employee.get.invalidate({ id: employeeId });
    },
  });

  const addSkillMutation = trpc.employee.addSkill.useMutation({
    onSuccess: () => {
      utils.employee.listSkills.invalidate({ employeeId });
      setShowSkillForm(false);
    },
  });

  const removeSkillMutation = trpc.employee.removeSkill.useMutation({
    onSuccess: () => {
      utils.employee.listSkills.invalidate({ employeeId });
    },
  });

  const refreshTimesheetData = () => {
    utils.employee.timesheets.invalidate({ employeeId, month: currentMonth, year: currentYear });
    utils.employee.monthlySummary.invalidate({ employeeId, month: currentMonth, year: currentYear });
    utils.employee.performance.invalidate({ employeeId });
  };

  const clockInMutation = trpc.employee.clockIn.useMutation({
    onSuccess: refreshTimesheetData,
  });

  const clockOutMutation = trpc.employee.clockOut.useMutation({
    onSuccess: refreshTimesheetData,
  });

  const onSubmit = (data: FormData) => updateMutation.mutate({ id: employeeId, ...data });
  const onRegisterClockIn = () => {
    if (!clockDate || !clockTime) return;
    clockInMutation.mutate({ employeeId, date: clockDate, time: clockTime });
  };
  const onRegisterClockOut = () => {
    if (!clockDate || !clockTime) return;
    clockOutMutation.mutate({ employeeId, date: clockDate, time: clockTime });
  };

  if (isLoadingEmp) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!employee) return <div>Funcionário não encontrado.</div>;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/funcionarios')} className="text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white">{employee.name}</h1>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            employee.isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
            {employee.isActive ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <div className="flex gap-2">
           {!isEditing ? (
             <button 
               onClick={() => { setIsEditing(true); reset(employee as unknown as FormData); }}
               className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
             >
               <Pencil size={15} /> Editar
             </button>
           ) : (
             <button 
               onClick={() => setIsEditing(false)}
               className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 text-neutral-400 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
             >
               Cancelar
             </button>
           )}
           {employee.isActive && (
             <button 
               onClick={() => { if(confirm('Deseja demitir este funcionário?')) dismissMutation.mutate({ id: employeeId, dismissalDate: new Date().toISOString() }); }}
               className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
             >
               <Trash2 size={15} /> Demitir
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           {/* Form / Details */}
           <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
             <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
               <div className="flex items-center justify-between">
                 <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                   <User size={16} className="text-violet-500" /> Dados Principais
                 </h2>
                 {isEditing && (
                    <button type="submit" className="text-violet-400 hover:text-violet-300 flex items-center gap-1 text-xs font-bold uppercase transition-colors">
                       <Save size={14} /> Salvar Alterações
                    </button>
                 )}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Nome Completo</label>
                   {isEditing ? (
                     <input {...register('name')} className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.name}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Email</label>
                   {isEditing ? (
                     <input {...register('email')} className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.email || '—'}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">CPF</label>
                   {isEditing ? (
                     <input {...register('cpf')} className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.cpf || '—'}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Telefone</label>
                   {isEditing ? (
                     <input {...register('phone')} className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.phone || '—'}</p>
                   )}
                 </div>
               </div>
             </section>

           <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
               <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                 <Briefcase size={16} className="text-violet-500" /> Contrato e Função
               </h2>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Cargo</label>
                   {isEditing ? (
                     <input {...register('position')} className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.position || '—'}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Tipo</label>
                   {isEditing ? (
                     <select {...register('type')} className="input-field w-full py-1.5">
                       <option value="protesista">Protesista</option>
                       <option value="auxiliar">Auxiliar</option>
                       <option value="recepcionista">Recepcionista</option>
                       <option value="gerente">Gerente</option>
                     </select>
                   ) : (
                     <p className="text-sm text-neutral-200 capitalize">{employee.type}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Contrato</label>
                   {isEditing ? (
                     <select {...register('contractType')} className="input-field w-full py-1.5">
                        <option value="clt">CLT</option>
                        <option value="pj_mei">PJ / MEI</option>
                        <option value="freelancer">Freelancer</option>
                     </select>
                   ) : (
                     <p className="text-sm text-neutral-200 uppercase">{employee.contractType}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Salário Base</label>
                   {isEditing ? (
                     <input {...register('baseSalaryCents', { valueAsNumber: true })} type="number" className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">R$ {((employee.baseSalaryCents || 0) / 100).toLocaleString('pt-BR')}</p>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs text-neutral-500 mb-1">Comissão (%)</label>
                   {isEditing ? (
                     <input {...register('defaultCommissionPercent', { valueAsNumber: true })} type="number" className="input-field w-full py-1.5" />
                   ) : (
                     <p className="text-sm text-neutral-200">{employee.defaultCommissionPercent}%</p>
                   )}
                 </div>
               </div>
             </section>
           </form>

           <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
             <div className="flex items-center justify-between">
               <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                 <BarChart3 size={16} className="text-violet-500" /> Desempenho e Ponto
               </h2>
               <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                 {String(currentMonth).padStart(2, '0')}/{currentYear}
               </span>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
               <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                 <div className="text-[10px] uppercase text-neutral-500">OS concluídas</div>
                 <div className="text-lg font-semibold text-white mt-1">{performance?.osCompleted ?? 0}</div>
               </div>
               <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                 <div className="text-[10px] uppercase text-neutral-500">Tempo médio</div>
                 <div className="text-lg font-semibold text-white mt-1">
                   {performance?.avgCompletionDays ?? 0} dias
                 </div>
               </div>
               <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                 <div className="text-[10px] uppercase text-neutral-500">Taxa atraso</div>
                 <div className="text-lg font-semibold text-white mt-1">{performance?.overdueRate ?? 0}%</div>
               </div>
               <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                 <div className="text-[10px] uppercase text-neutral-500">Comissões mês</div>
                 <div className="text-sm font-semibold text-white mt-1">
                   {((performance?.commissionsTotalCents ?? 0) / 100).toLocaleString('pt-BR', {
                     style: 'currency',
                     currency: 'BRL',
                   })}
                 </div>
               </div>
               <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                 <div className="text-[10px] uppercase text-neutral-500">Horas trabalhadas</div>
                 <div className="text-lg font-semibold text-white mt-1">{performance?.hoursThisMonth ?? 0}h</div>
               </div>
             </div>

             <div className="flex flex-col md:flex-row md:items-end gap-3">
               <div>
                 <label className="block text-xs text-neutral-500 mb-1">Data</label>
                 <input type="date" value={clockDate} onChange={(e) => setClockDate(e.target.value)} className="input-field" />
               </div>
               <div>
                 <label className="block text-xs text-neutral-500 mb-1">Hora</label>
                 <input type="time" value={clockTime} onChange={(e) => setClockTime(e.target.value)} className="input-field" />
               </div>
               <button
                 type="button"
                 onClick={onRegisterClockIn}
                 disabled={clockInMutation.isPending}
                 className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium text-white transition-colors"
               >
                 {clockInMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Clock3 size={14} />}
                 Registrar Entrada
               </button>
               <button
                 type="button"
                 onClick={onRegisterClockOut}
                 disabled={clockOutMutation.isPending}
                 className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-sm font-medium text-white transition-colors"
               >
                 {clockOutMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />}
                 Registrar Saída
               </button>
             </div>

             {(clockInMutation.error || clockOutMutation.error) && (
               <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-xs text-red-300">
                 {clockInMutation.error?.message ?? clockOutMutation.error?.message}
               </div>
             )}

             <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
               <table className="w-full text-sm">
                 <thead className="bg-neutral-900 border-b border-neutral-800">
                   <tr className="text-left text-neutral-400">
                     <th className="px-4 py-3">Data</th>
                     <th className="px-4 py-3">Entrada</th>
                     <th className="px-4 py-3">Saída</th>
                     <th className="px-4 py-3">Horas</th>
                     <th className="px-4 py-3">Observações</th>
                   </tr>
                 </thead>
                 <tbody>
                   {timesheets?.map((entry) => (
                     <tr key={entry.id} className="border-b border-neutral-800 last:border-b-0">
                       <td className="px-4 py-3 text-neutral-200">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                       <td className="px-4 py-3 text-neutral-300">{formatTime(entry.clockIn)}</td>
                       <td className="px-4 py-3 text-neutral-300">{formatTime(entry.clockOut)}</td>
                       <td className="px-4 py-3 text-neutral-300">{entry.hoursWorked ? `${Number(entry.hoursWorked).toFixed(2)}h` : '-'}</td>
                       <td className="px-4 py-3 text-neutral-400">{entry.notes || '-'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {(timesheets?.length ?? 0) === 0 && (
                 <div className="p-6 text-xs text-neutral-500 text-center">
                   Nenhum lançamento de ponto neste mês.
                 </div>
               )}
             </div>

             <div className="flex items-center justify-end gap-3 text-[11px] text-neutral-400">
               <span className="inline-flex items-center gap-1">
                 <Wallet size={12} />
                 Horas totais: {monthlySummary?.totalHours ?? 0}h
               </span>
               <span>Dias com registro: {monthlySummary?.workedDays ?? 0}</span>
               <span>Dias em aberto: {monthlySummary?.openDays ?? 0}</span>
             </div>
           </section>

           {/* Assignments / Production */}
           <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <History size={16} className="text-violet-500" /> Histórico de Produção Recente
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="pb-3 text-[10px] font-bold text-neutral-500 uppercase">OS</th>
                      <th className="pb-3 text-[10px] font-bold text-neutral-500 uppercase">Tarefa</th>
                      <th className="pb-3 text-[10px] font-bold text-neutral-500 uppercase">Comissão</th>
                      <th className="pb-3 text-[10px] font-bold text-neutral-500 uppercase text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {assignments?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-xs text-neutral-500">Nenhuma OS atribuída ainda.</td>
                      </tr>
                    ) : (
                      assignments?.map((as) => (
                        <tr key={as.id} className="text-sm">
                          <td className="py-3 text-violet-400 font-medium">#{as.jobId}</td>
                          <td className="py-3 text-neutral-300">{as.task || 'Geral'}</td>
                          <td className="py-3">
                            {as.commissionAmountCents ? `R$ ${(as.commissionAmountCents / 100).toFixed(2)}` : <span className="text-neutral-600 text-[10px]">Aguardando cálculo</span>}
                          </td>
                          <td className="py-3 text-neutral-500 text-right text-xs">
                             {new Date(as.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
           </section>
        </div>

        {/* Skills sidebar */}
        <div className="space-y-6">
           <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
             <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                  <Award size={16} className="text-violet-500" /> Habilidades
                </h2>
                <button onClick={() => setShowSkillForm(true)} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-violet-400 transition-colors">
                   <Plus size={14} />
                </button>
             </div>
             
             {showSkillForm && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                   <input id="skillName" placeholder="Nome da técnica" className="input-field w-full text-xs" />
                   <select id="skillLevel" className="input-field w-full text-xs">
                      <option value="1">Básico</option>
                      <option value="2">Intermediário</option>
                      <option value="3">Avançado</option>
                      <option value="4">Especialista</option>
                   </select>
                   <div className="flex gap-2">
                      <button onClick={() => setShowSkillForm(false)} className="flex-1 py-1 text-[10px] text-neutral-500 border border-neutral-800 rounded-md">Cancelar</button>
                      <button 
                        onClick={() => {
                          const name = (document.getElementById('skillName') as HTMLInputElement).value;
                          const level = Number((document.getElementById('skillLevel') as HTMLSelectElement).value);
                          if(name) addSkillMutation.mutate({ employeeId, name, level });
                        }}
                        className="flex-1 py-1 text-[10px] bg-violet-600 text-white rounded-md"
                      >Adicionar</button>
                   </div>
                </div>
             )}

             <div className="space-y-3">
                {skills?.length === 0 && !showSkillForm && <p className="text-xs text-neutral-600 italic">Nenhuma habilidade cadastrada.</p>}
                {skills?.map(skill => (
                  <div key={skill.id} className="flex items-center justify-between group">
                    <div>
                      <div className="text-sm font-medium text-neutral-200">{skill.name}</div>
                      <div className="flex gap-1 mt-1">
                        {[1,2,3,4].map(l => (
                          <div key={l} className={`h-1 w-4 rounded-full ${l <= skill.level ? 'bg-violet-500' : 'bg-neutral-800'}`} />
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => removeSkillMutation.mutate({ skillId: skill.id })}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-600 hover:text-red-400 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
             </div>
           </section>

           <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <History size={16} className="text-violet-500" /> Metadados
              </h2>
              <div className="space-y-2 text-[10px] text-neutral-500 uppercase tracking-widest">
                 <div>Criado em: {new Date(employee.createdAt).toLocaleString('pt-BR')}</div>
                 <div>Última alt: {new Date(employee.updatedAt).toLocaleString('pt-BR')}</div>
                 {employee.dismissalDate && <div className="text-red-400">Demitido em: {new Date(employee.dismissalDate).toLocaleString('pt-BR')}</div>}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
