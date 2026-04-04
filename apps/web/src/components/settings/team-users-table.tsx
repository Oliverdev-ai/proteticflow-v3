import { 
  Users, Mail, Shield, ShieldCheck, 
  Activity, User, UserPlus
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ROLE_LABELS, type Role } from '@proteticflow/shared';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

interface TeamUsersTableProps {
  showRoleActions?: boolean;
}

export function TeamUsersTable({ showRoleActions = false }: TeamUsersTableProps) {
  const utils = trpc.useUtils();
  const usersQuery = trpc.auth.listTeamUsers.useQuery();
  const updateRoleMutation = trpc.auth.updateUserRole.useMutation({
    onSuccess: async () => {
      await utils.auth.listTeamUsers.invalidate();
    },
  });

  const users = usersQuery.data ?? [];

  const handleUpdateRole = async (userId: string, currentRole: Role) => {
    const nextRole: Role = currentRole === 'manager' ? 'staff' : 'manager';
    await updateRoleMutation.mutateAsync({ userId, role: nextRole });
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] overflow-hidden group/team shadow-xl shadow-black/5">
        {/* Header Area */}
        <div className="p-8 border-b border-border/50 bg-card/30 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                 <Users size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                 <Large className="tracking-tight text-lg font-black uppercase">Terminais Operacionais</Large>
                 <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Gestão de identidades e vinculação de dispositivos</Muted>
              </div>
           </div>
           
           <button className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-30">
              <UserPlus size={14} strokeWidth={3} /> Convidar Membro
           </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">Membro / Terminal</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">Credencial</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">Privilégio</th>
                {showRoleActions && (
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((u) => (
                <tr key={u.id} className="group/row hover:bg-primary/[0.01] transition-all duration-300">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-muted border border-border/50 flex items-center justify-center p-0.5 group-hover/row:border-primary/40 transition-all overflow-hidden shadow-inner">
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <User size={20} className="text-muted-foreground" />
                          )}
                       </div>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-black text-foreground tracking-tight group-hover/row:text-primary transition-colors">{u.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 opacity-60">
                             <Activity size={10} className="text-emerald-500" /> Online
                          </span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 group-hover/row:translate-x-1 transition-transform">
                       <Mail size={12} className="text-primary/40" />
                       <span className="text-xs font-black text-muted-foreground/80">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      u.role === 'superadmin' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      u.role === 'manager' ? "bg-violet-500/10 text-violet-500 border-violet-500/20" :
                      "bg-primary/10 text-primary border-primary/20"
                    )}>
                       {u.role === 'superadmin' ? <Shield size={10} /> : <ShieldCheck size={10} />}
                       {ROLE_LABELS[u.role as Role] || u.role}
                    </div>
                  </td>
                  {showRoleActions && (
                    <td className="px-10 py-6 text-right">
                      {u.role !== 'superadmin' && (
                        <button
                          onClick={() => handleUpdateRole(u.id, u.role as Role)}
                          disabled={updateRoleMutation.isPending}
                          className="px-6 py-2.5 rounded-xl bg-muted border border-border text-[9px] font-black uppercase tracking-widest hover:bg-muted-foreground hover:text-white transition-all active:scale-95 disabled:opacity-30"
                        >
                          Alterar Nível
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-8 bg-muted/10 border-t border-border/50">
           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-relaxed opacity-40 max-w-2xl">
              * Superadmins possuem acesso total à malha fiscal e financeira. Gerentes podem gerenciar estoque e clientes, mas não possuem privilégios de auditoria de sistema.
           </p>
        </div>
        
        {/* Interactive background highlight */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/team:bg-primary/[0.02] transition-colors duration-1000" />
      </div>
    </div>
  );
}
