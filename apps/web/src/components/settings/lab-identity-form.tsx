import { useEffect, useState } from 'react';
import { 
  Building2, Hash, Mail, Phone, 
  MapPin, Globe, Save, Loader2,
  CheckCircle2, Landmark, Compass
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function LabIdentityForm() {
  const { overview, updateIdentity } = useSettings();
  const identity = overview.data?.identity;

  const [name, setName] = useState(identity?.name ?? '');
  const [cnpj, setCnpj] = useState(identity?.cnpj ?? '');
  const [email, setEmail] = useState(identity?.email ?? '');
  const [phone, setPhone] = useState(identity?.phone ?? '');
  const [address, setAddress] = useState(identity?.address ?? '');
  const [city, setCity] = useState(identity?.city ?? '');
  const [state, setState] = useState(identity?.state ?? '');
  const [website, setWebsite] = useState(identity?.website ?? '');

  useEffect(() => {
    if (!identity) return;
    setName(identity.name ?? '');
    setCnpj(identity.cnpj ?? '');
    setEmail(identity.email ?? '');
    setPhone(identity.phone ?? '');
    setAddress(identity.address ?? '');
    setCity(identity.city ?? '');
    setState(identity.state ?? '');
    setWebsite(identity.website ?? '');
  }, [identity]);

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-10 relative overflow-hidden group/lab">
        <div className="flex items-center gap-4 relative">
           <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Landmark size={18} strokeWidth={3} />
           </div>
           <div className="flex flex-col gap-0.5">
              <Large className="tracking-tight text-lg font-black uppercase">Chancela Institucional</Large>
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Dados jurídicos e de localização do laboratório</Muted>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
           {/* Nome Fantasia */}
           <div className="flex flex-col gap-1">
              <label className={labelClass}>
                 <Building2 size={12} className="text-primary/40" /> Razão Social / Fantasia
              </label>
              <input className={inputClass} placeholder="Nome do Laboratório" value={name} onChange={(e) => setName(e.target.value)} />
           </div>

           {/* CNPJ */}
           <div className="flex flex-col gap-1">
              <label className={labelClass}>
                 <Hash size={12} className="text-primary/40" /> Inscrição Federal (CNPJ)
              </label>
              <input className={inputClass} placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
           </div>

           {/* Email */}
           <div className="flex flex-col gap-1">
              <label className={labelClass}>
                 <Mail size={12} className="text-primary/40" /> Email Corporativo
              </label>
              <input className={inputClass} placeholder="lab@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
           </div>

           {/* Telefone */}
           <div className="flex flex-col gap-1">
              <label className={labelClass}>
                 <Phone size={12} className="text-primary/40" /> Terminal de Voz
              </label>
              <input className={inputClass} placeholder="(00) 0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
           </div>

           {/* Endereço Completo */}
           <div className="flex flex-col gap-1 md:col-span-2">
              <label className={labelClass}>
                 <MapPin size={12} className="text-primary/40" /> Logradouro de Operação
              </label>
              <input className={inputClass} placeholder="Rua, Número, Bairro, Complemento" value={address} onChange={(e) => setAddress(e.target.value)} />
           </div>

           {/* Cidade & Estado */}
           <div className="grid grid-cols-3 gap-6 md:col-span-2">
              <div className="col-span-2 flex flex-col gap-1">
                 <label className={labelClass}>
                    <Compass size={12} className="text-primary/40" /> Município
                 </label>
                 <input className={inputClass} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                 <label className={labelClass}>
                    <MapPin size={12} className="text-primary/40" /> UF
                 </label>
                 <input className={cn(inputClass, "text-center")} placeholder="UF" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
              </div>
           </div>

           {/* Website */}
           <div className="flex flex-col gap-1 md:col-span-2">
              <label className={labelClass}>
                 <Globe size={12} className="text-primary/40" /> Website / Portfólio Digital
              </label>
              <input className={inputClass} placeholder="https://www.lab.com.br" value={website} onChange={(e) => setWebsite(e.target.value)} />
           </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-border/50 pt-8 mt-2 relative">
           {updateIdentity.isSuccess && (
             <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-4">
                <CheckCircle2 size={16} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase tracking-widest">Identidade Sincronizada</span>
             </div>
           )}
           <button
             onClick={() => updateIdentity.mutate({ name, cnpj, email, phone, address, city, state, website })}
             disabled={updateIdentity.isPending}
             className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
           >
             {updateIdentity.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
             Salvar Alterações
           </button>
        </div>

        {/* Decorative backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover/lab:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
