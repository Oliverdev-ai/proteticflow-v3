import { ROLE_PERMISSIONS, ROLE_LABELS, type Role } from '@proteticflow/shared';
import { Shield, ShieldCheck, Zap, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function RolesMatrix() {
  const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

  const roleColors: Record<string, string> = {
    admin: "text-primary bg-primary/10 border-primary/20",
    manager: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
    technician: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    receptionist: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    user: "text-muted-foreground bg-muted border-border",
  };

  return (
    <div className="bg-card/20 backdrop-blur-sm border border-border/50 rounded-[32px] overflow-hidden group/matrix">
       <div className="p-8 border-b border-border/50 bg-card/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <ShieldCheck size={20} strokeWidth={2.5} />
             </div>
             <div className="flex flex-col gap-0.5">
                <Large className="tracking-tight text-base font-black uppercase">Matriz de Privilégios</Large>
                <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">Regras de herança e níveis de segurança</Muted>
             </div>
          </div>
          
          <div className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 animate-in slide-in-from-right-4">
            <Zap size={10} strokeWidth={3} /> {roles.length} Níveis Definidos
          </div>
       </div>

       <div className="overflow-x-auto">
         <table className="w-full border-collapse">
           <thead>
             <tr className="border-b border-border bg-muted/20">
               <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">Classe Hierárquica</th>
               <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">Módulos de Alfaiataria (Permissões)</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-border/50">
             {roles.map((role) => (
               <tr key={role} className="group/row hover:bg-primary/[0.01] transition-all duration-300">
                 <td className="px-8 py-8 w-1/3">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 shadow-xl",
                         roleColors[role] || roleColors.user
                       )}>
                          <Shield size={20} strokeWidth={3} />
                       </div>
                       <div className="flex flex-col gap-0.5">
                          <span className={cn(
                            "text-base font-black tracking-tight transition-colors",
                            roleColors[role]?.split(' ')[0]
                          )}>
                             {ROLE_LABELS[role]}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest leading-none">Perfil Sistêmico</span>
                       </div>
                    </div>
                 </td>
                 <td className="px-8 py-8">
                    <div className="flex flex-wrap gap-2 relative">
                       {ROLE_PERMISSIONS[role].modules.map((module) => (
                          <div key={module} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shadow-sm group-hover/row:scale-105 group-hover/row:border-primary/20 transition-all">
                             <div className="w-1 h-1 rounded-full bg-primary" />
                             <span className="text-[10px] font-black text-foreground uppercase tracking-widest leading-none">{module}</span>
                          </div>
                       ))}
                    </div>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       <div className="p-6 bg-muted/30 border-t border-border flex items-center gap-3">
          <Activity size={14} className="text-primary/40" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Esta matriz é imutável via interface para garantir a estabilidade do núcleo de segurança.</span>
       </div>

       {/* Decorative backdrop */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/matrix:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
