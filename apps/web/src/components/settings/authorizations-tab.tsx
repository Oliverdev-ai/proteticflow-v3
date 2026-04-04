import { TeamUsersTable } from './team-users-table';
import { RolesMatrix } from './roles-matrix';
import { Large, Muted } from '../shared/typography';
import { ShieldCheck } from 'lucide-react';

export function AuthorizationsTab() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4 relative ml-4">
         <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <ShieldCheck size={18} strokeWidth={3} />
         </div>
         <div className="flex flex-col gap-0.5">
            <Large className="tracking-tight text-lg font-black uppercase">Matriz de Autoritividade</Large>
            <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Gestão de acessos e herança de privilégios</Muted>
         </div>
      </div>
      
      <TeamUsersTable showRoleActions={true} />
      <RolesMatrix />
    </div>
  );
}
