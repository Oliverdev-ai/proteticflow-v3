import { TeamUsersTable } from './team-users-table';
import { Large, Muted } from '../shared/typography';
import { Users } from 'lucide-react';

export function EmployeesTab() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4 relative ml-4 transition-all animate-in fade-in slide-in-from-left-4">
         <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Users size={18} strokeWidth={3} />
         </div>
         <div className="flex flex-col gap-0.5">
            <Large className="tracking-tight text-lg font-black uppercase">Elenco Operacional</Large>
            <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Listagem de terminais e operadores ativos</Muted>
         </div>
      </div>
      
      <TeamUsersTable showRoleActions={false} />
    </div>
  );
}
