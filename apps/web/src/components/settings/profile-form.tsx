import { 
  User, Mail, Phone, MapPin, 
  ShieldCheck, Lock, Save, Loader2, 
  CheckCircle2, Key, Info, 
  AtSign, Github, Linkedin, Briefcase
} from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { Large, Muted } from '../shared/typography';
import { useState } from 'react';

export function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form states
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await updateProfile.mutateAsync({ name, phone });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bio Card - Bento Large */}
        <div className="lg:col-span-2 bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-8 relative overflow-hidden group/profile shadow-xl shadow-black/5">
           <div className="flex items-center gap-6 relative">
              <div className="w-20 h-20 rounded-[28px] bg-primary/10 border-2 border-primary/20 flex items-center justify-center p-1 group-hover/profile:border-primary/40 transition-all shadow-inner overflow-hidden">
                 {user?.avatarUrl ? (
                   <img src={user.avatarUrl} alt={user.name ?? 'Avatar'} className="w-full h-full object-cover rounded-[22px]" />
                  ) : (
                    <User size={32} className="text-primary" strokeWidth={2.5} />
                  )}
              </div>
              <div className="flex flex-col gap-1">
                 <Large className="text-2xl font-black uppercase tracking-tight">{user?.name || 'Comandante'}</Large>
                 <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                       <ShieldCheck size={10} strokeWidth={3} /> {user?.role || 'Operator'}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 italic">Identidade de Acesso Web 3.0</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              <div className="flex flex-col gap-1">
                 <label className={labelClass}>
                    <AtSign size={12} className="text-primary/40" /> Nome Completo de Registro
                 </label>
                 <input className={inputClass} placeholder="Digite seu nome" value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1">
                 <label className={labelClass}>
                    <Mail size={12} className="text-primary/40" /> E-mail Institucional (ReadOnly)
                 </label>
                 <input className={inputClass} value={user?.email ?? ''} readOnly disabled />
              </div>

              <div className="flex flex-col gap-1">
                 <label className={labelClass}>
                    <Phone size={12} className="text-primary/40" /> Terminal Telefônico / WhatsApp
                 </label>
                 <input className={inputClass} placeholder="+55 (00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1">
                 <label className={labelClass}>
                    <MapPin size={12} className="text-primary/40" /> Geo-Localização Referencial
                 </label>
                 <input className={inputClass} placeholder="Cidade/Estado" disabled value="São Paulo / SP" />
              </div>
           </div>

           <div className="flex items-center justify-end gap-4 border-t border-border/50 pt-8 mt-2">
              {success && (
                <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-4">
                   <CheckCircle2 size={16} strokeWidth={3} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Sincronizado</span>
                </div>
              )}
              <button 
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
              >
                 {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
                 Efetivar Alterações
              </button>
           </div>
           
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/profile:bg-primary/[0.02] transition-colors duration-1000" />
        </div>

        {/* Security / Links Card - Bento Small */}
        <div className="flex flex-col gap-8">
           <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-6 relative overflow-hidden group/security shadow-lg shadow-black/5">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                    <Lock size={18} strokeWidth={3} />
                 </div>
                 <div className="flex flex-col">
                    <Large className="text-sm font-black uppercase tracking-wider">Auditória de Segurança</Large>
                    <Muted className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30">Infra de autenticação</Muted>
                 </div>
              </div>
              
              <div className="flex flex-col gap-3">
                 <button className="flex items-center justify-between w-full p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all text-left group/btn">
                    <div className="flex items-center gap-3">
                       <Key size={14} className="text-muted-foreground group-hover/btn:text-primary transition-colors" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Redefinir Credencial</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary/20 group-hover/btn:bg-primary transition-all shadow-glow" />
                 </button>
                 <button className="flex items-center justify-between w-full p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all text-left group/btn">
                    <div className="flex items-center gap-3">
                       <Briefcase size={14} className="text-muted-foreground group-hover/btn:text-primary transition-colors" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Logs de Acesso</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary/20 group-hover/btn:bg-primary transition-all shadow-glow" />
                 </button>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                 <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider leading-relaxed opacity-50">
                    Sua conta utiliza OAuth 2.0 via Protetic-Identity. Para desvincular provedores, acesse o portal central.
                 </p>
              </div>
           </div>

           <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-6 relative overflow-hidden group/social shadow-lg shadow-black/5">
              <div className="flex items-center gap-3 mb-2">
                 <div className="flex items-center gap-1">
                    {[Github, Linkedin].map((Icon, i) => (
                      <div key={i} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all cursor-pointer">
                         <Icon size={14} />
                      </div>
                    ))}
                 </div>
                 <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Integrações Sociais</span>
              </div>
              <div className="flex items-start gap-4">
                 <Info size={16} className="text-primary shrink-0 mt-0.5" />
                 <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tight opacity-60 leading-normal">
                    Assinatura de commits e vinculação de repositórios ativa para o ambiente de dev CLI.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
