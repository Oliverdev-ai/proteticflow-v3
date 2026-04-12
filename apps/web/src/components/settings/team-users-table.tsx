import {
  Users, Mail, Shield, ShieldCheck,
  Activity, UserPlus,
} from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@proteticflow/shared';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';
import { useSettings } from '../../hooks/use-settings';
import { trpc } from '../../lib/trpc';

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
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>(ROLES.RECEPCAO);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteMutation = trpc.tenant.invite.useMutation({
    onSuccess: () => {
      setInviteError(null);
      setInviteFeedback('Convite enviado com sucesso.');
      setInviteEmail('');
      setInviteRole(ROLES.RECEPCAO);
      setShowInviteForm(false);
      void overview.refetch();
    },
    onError: (error) => {
      setInviteFeedback(null);
      setInviteError(error.message);
    },
  });

  const handleUpdateRole = async (memberId: number, currentRole: Role) => {
    const nextRole = getNextRole(currentRole);
    if (nextRole === currentRole) return;
    await updateRole.mutateAsync({ memberId, role: nextRole });
  };

  const handleInvite = () => {
    setInviteFeedback(null);
    setInviteError(null);
    if (!inviteEmail.trim()) {
      setInviteError('Informe um email valido para convite.');
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
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
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Gestão de identidades e vinculação de dispositivos</Muted>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setInviteFeedback(null);
              setInviteError(null);
              setShowInviteForm((value) => !value);
            }}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-30"
          >
            <UserPlus size={14} strokeWidth={3} /> Convidar Membro
          </button>
        </div>

        {showInviteForm && (
          <div className="px-8 pb-8">
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-[1fr_auto_auto]">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="email@empresa.com"
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary/50"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Role)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary/50"
              >
                <option value={ROLES.RECEPCAO}>{ROLE_LABELS[ROLES.RECEPCAO]}</option>
                <option value={ROLES.PRODUCAO}>{ROLE_LABELS[ROLES.PRODUCAO]}</option>
                <option value={ROLES.CONTABIL}>{ROLE_LABELS[ROLES.CONTABIL]}</option>
                <option value={ROLES.GERENTE}>{ROLE_LABELS[ROLES.GERENTE]}</option>
              </select>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviteMutation.isPending}
                className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
              </button>
            </div>
          </div>
        )}

        {inviteFeedback ? (
          <p className="px-8 pb-3 text-xs font-semibold text-emerald-500">{inviteFeedback}</p>
        ) : null}
        {inviteError ? (
          <p className="px-8 pb-3 text-xs font-semibold text-red-400">Erro: {inviteError}</p>
        ) : null}

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
                            Alterar Nível
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
            * Superadmins possuem acesso total à malha fiscal e financeira. O rodízio de privilégios não altera o último superadmin ativo.
          </p>
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/team:bg-primary/[0.02] transition-colors duration-1000" />
      </div>
    </div>
  );
}
