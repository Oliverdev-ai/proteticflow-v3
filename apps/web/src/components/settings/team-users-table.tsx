import {
  Users, Mail, Shield, ShieldCheck,
  Activity, UserPlus,
} from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@proteticflow/shared';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';
import { useSettings } from '../../hooks/use-settings';

interface TeamUsersTableProps {
  showRoleActions?: boolean;
}

const ROLE_ROTATION: Role[] = [ROLES.RECEPCAO, ROLES.PRODUCAO, ROLES.CONTABIL, ROLES.GERENTE];

function getNextRole(currentRole: Role): Role {
  if (currentRole === ROLES.SUPERADMIN) return ROLES.SUPERADMIN;
  const currentIndex = ROLE_ROTATION.indexOf(currentRole);
  if (currentIndex === -1) return ROLES.RECEPCAO;
  return ROLE_ROTATION[(currentIndex + 1) % ROLE_ROTATION.length] ?? ROLES.RECEPCAO;
}

function getInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'U';
  return tokens.slice(0, 2).map((token) => token[0]?.toUpperCase() ?? '').join('');
}

export function TeamUsersTable({ showRoleActions = false }: TeamUsersTableProps) {
  const { overview, updateRole } = useSettings();
  const users = overview.data?.users ?? [];

  const handleUpdateRole = async (memberId: number, currentRole: Role) => {
    const nextRole = getNextRole(currentRole);
    if (nextRole === currentRole) return;
    await updateRole.mutateAsync({ memberId, role: nextRole });
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] overflow-hidden group/team shadow-xl shadow-black/5">
        <div className="p-8 border-b border-border/50 bg-card/30 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-0.5">
              <Large className="tracking-tight text-lg font-black uppercase">Terminais Operacionais</Large>
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">GestÃ£o de identidades e vinculaÃ§Ã£o de dispositivos</Muted>
            </div>
          </div>

          <button
            type="button"
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-30"
          >
            <UserPlus size={14} strokeWidth={3} /> Convidar Membro
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">Membro / Terminal</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">Credencial</th>
                <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-6">PrivilÃ©gio</th>
                {showRoleActions && (
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">AÃ§Ãµes</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={showRoleActions ? 4 : 3} className="px-10 py-12 text-center">
                    <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                      Nenhum usuario
                    </span>
                  </td>
                </tr>
              ) : (
                users.map((userItem) => (
                  <tr key={userItem.id} className="group/row hover:bg-primary/[0.01] transition-all duration-300">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted border border-border/50 flex items-center justify-center group-hover/row:border-primary/40 transition-all shadow-inner text-xs font-black text-muted-foreground">
                          {getInitials(userItem.name)}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-black text-foreground tracking-tight group-hover/row:text-primary transition-colors">{userItem.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 opacity-60">
                            <Activity size={10} className="text-emerald-500" /> Online
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 group-hover/row:translate-x-1 transition-transform">
                        <Mail size={12} className="text-primary/40" />
                        <span className="text-xs font-black text-muted-foreground/80">{userItem.email}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border',
                          userItem.role === ROLES.SUPERADMIN
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : userItem.role === ROLES.GERENTE
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {userItem.role === ROLES.SUPERADMIN ? <Shield size={10} /> : <ShieldCheck size={10} />}
                        {ROLE_LABELS[userItem.role]}
                      </div>
                    </td>
                    {showRoleActions && (
                      <td className="px-10 py-6 text-right">
                        {userItem.role !== ROLES.SUPERADMIN && (
                          <button
                            type="button"
                            onClick={() => handleUpdateRole(userItem.id, userItem.role)}
                            disabled={updateRole.isPending}
                            className="px-6 py-2.5 rounded-xl bg-muted border border-border text-[9px] font-black uppercase tracking-widest hover:bg-muted-foreground hover:text-white transition-all active:scale-95 disabled:opacity-30"
                          >
                            Alterar NÃ­vel
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-muted/10 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-relaxed opacity-40 max-w-2xl">
            * Superadmins possuem acesso total Ã  malha fiscal e financeira. O rodÃ­zio de privilÃ©gios nÃ£o altera o Ãºltimo superadmin ativo.
          </p>
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/team:bg-primary/[0.02] transition-colors duration-1000" />
      </div>
    </div>
  );
}
