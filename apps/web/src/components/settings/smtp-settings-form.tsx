import { useState } from 'react';
import { 
  Server, Key, 
  Send, Loader2, CheckCircle2,
  Activity, Info, Lock, Network, Save
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function SmtpSettingsForm() {
  const { overview, updateSmtp, testSmtp } = useSettings();
  const smtp = overview.data?.smtp;

  const [smtpMode, setSmtpMode] = useState<'resend_fallback' | 'custom_smtp'>(smtp?.smtpMode ?? 'resend_fallback');
  const [smtpHost, setSmtpHost] = useState(smtp?.smtpHost ?? '');
  const [smtpPort, setSmtpPort] = useState(smtp?.smtpPort?.toString() ?? '587');
  const [smtpSecure, setSmtpSecure] = useState(Boolean(smtp?.smtpSecure));
  const [smtpUsername, setSmtpUsername] = useState(smtp?.smtpUsername ?? '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState(smtp?.smtpFromName ?? '');
  const [smtpFromEmail, setSmtpFromEmail] = useState(smtp?.smtpFromEmail ?? '');

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-8 relative overflow-hidden group/smtp">
       <div className="flex items-center gap-4 relative">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
             <Send size={18} strokeWidth={3} />
          </div>
          <div className="flex flex-col gap-0.5">
             <Large className="tracking-tight text-lg font-black uppercase">Motor de Mensageria (SMTP)</Large>
             <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Infraestrutura para envio de notificações e faturas por e-mail</Muted>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
          {/* Configuração de Modo */}
          <div className="md:col-span-2 flex flex-col gap-1">
             <label className={labelClass}>
                <Activity size={12} className="text-primary/40" /> Modo de Operação
             </label>
             <select
               value={smtpMode}
               onChange={(e) => setSmtpMode(e.target.value as 'resend_fallback' | 'custom_smtp')}
               className={inputClass}
             >
               <option value="resend_fallback">Resend Fallback (Assinado Proteticflow)</option>
               <option value="custom_smtp">Servidor SMTP Customizado (E-mail do Lab)</option>
             </select>
          </div>

          {smtpMode === 'custom_smtp' && (
            <>
               <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                     <Server size={12} className="text-primary/40" /> Host do Servidor
                  </label>
                  <input className={inputClass} placeholder="smtp.exemplo.com" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
               </div>

               <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                     <Network size={12} className="text-primary/40" /> Porta TCP
                  </label>
                  <input className={cn(inputClass, "text-center tabular-nums")} placeholder="587 / 465" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
               </div>

               <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                     <Key size={12} className="text-primary/40" /> Usuário / Login
                  </label>
                  <input className={inputClass} placeholder="lab@exemplo.com" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} />
               </div>

               <div className="flex flex-col gap-1">
                  <label className={labelClass}>
                     <Lock size={12} className="text-primary/40" /> Senha de Autenticação
                  </label>
                  <input type="password" className={inputClass} placeholder={smtp?.hasPassword ? '******** (senha salva)' : 'Credencial secreta'} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} />
               </div>
            </>
          )}

          {/* Identidade visual do remetente */}
          <div className="flex flex-col gap-1">
             <label className={labelClass}>Nome do Remetente</label>
             <input className={inputClass} placeholder="Laboratório Exemplo" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
             <label className={labelClass}>E-mail de Resposta (Reply-To)</label>
             <input className={inputClass} placeholder="contato@lab.com" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} />
          </div>

          {smtpMode === 'custom_smtp' && (
            <div className="md:col-span-2">
               <label className="flex items-center gap-3 cursor-pointer group/toggle w-fit">
                  <input type="checkbox" className="sr-only peer" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
                  <div className="w-10 h-5 bg-muted rounded-full border border-border peer-checked:bg-primary/20 peer-checked:border-primary/40 relative transition-all shadow-inner">
                     <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground rounded-full peer-checked:left-6 peer-checked:bg-primary transition-all" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/toggle:text-foreground transition-colors">Usar Camada de Segurança (TLS/SSL)</span>
               </label>
            </div>
          )}
       </div>

       <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border/50 pt-8 mt-2">
          {testSmtp.isSuccess && (
            <div className="mr-auto flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-left-4">
               <CheckCircle2 size={16} strokeWidth={3} />
               <span className="text-[10px] font-black uppercase tracking-widest">Teste de Conexão OK</span>
            </div>
          )}
          
          <button 
            onClick={() => testSmtp.mutate({})} 
            disabled={testSmtp.isPending}
            className="flex items-center gap-3 bg-muted border border-border text-foreground hover:bg-muted/80 px-8 py-3.5 rounded-2xl transition-all active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
          >
             {testSmtp.isPending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} strokeWidth={3} />}
             Validar Link
          </button>

          <button
            onClick={() => updateSmtp.mutate({
              smtpMode,
              smtpHost,
              smtpPort: Number(smtpPort),
              smtpSecure,
              smtpUsername,
              smtpPassword: smtpPassword || undefined,
              smtpFromName,
              smtpFromEmail,
            })}
            disabled={updateSmtp.isPending}
            className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
          >
            {updateSmtp.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
            Efetivar SMTP
          </button>
       </div>

       {/* Footer Info */}
       <div className="p-6 bg-muted/30 border border-border rounded-[24px] flex items-start gap-4">
          <Info size={18} className="text-primary mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight leading-relaxed opacity-60">
             O Proteticflow utiliza SMTP assíncrono. Em caso de volumes altos de faturas, recomendamos o uso de chaves dedicadas (SendGrid/Resend) ou um servidor corporativo robusto para evitar atrasos na fila de transmissão.
          </p>
       </div>

       {/* Decorative backdrop */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover/smtp:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
