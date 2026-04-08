import { useEffect, useState } from 'react';
import { 
  Receipt, CreditCard, 
  Save, 
  Loader2, CheckCircle2, Globe, Info
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function FiscalSettingsForm() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.fiscal.getFiscalSettings.useQuery();
  const upsertMutation = trpc.fiscal.upsertFiscalSettings.useMutation({
    onSuccess: async () => {
      await utils.fiscal.getFiscalSettings.invalidate();
    },
  });

  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [taxRegime, setTaxRegime] = useState<'simples' | 'lucro_presumido' | 'lucro_real'>('simples');
  const [defaultServiceCode, setDefaultServiceCode] = useState('');
  const [defaultServiceName, setDefaultServiceName] = useState('');
  const [issqnRatePercent, setIssqnRatePercent] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasSandbox, setAsaasSandbox] = useState(true);
  const [focusApiToken, setFocusApiToken] = useState('');
  const [focusSandbox, setFocusSandbox] = useState(true);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;

    setMunicipalRegistration(data.municipalRegistration ?? '');
    setTaxRegime((data.taxRegime as 'simples' | 'lucro_presumido' | 'lucro_real' | null) ?? 'simples');
    setDefaultServiceCode(data.defaultServiceCode ?? '');
    setDefaultServiceName(data.defaultServiceName ?? '');
    setIssqnRatePercent(data.issqnRatePercent ?? '');
    setCityCode(data.cityCode ?? '');
    setAsaasSandbox(data.asaasSandbox);
    setFocusSandbox(data.focusSandbox);
  }, [settingsQuery.data]);

  async function handleSave(): Promise<void> {
    const payload: {
      taxRegime?: 'simples' | 'lucro_presumido' | 'lucro_real';
      asaasSandbox?: boolean;
      focusSandbox?: boolean;
      municipalRegistration?: string;
      defaultServiceCode?: string;
      defaultServiceName?: string;
      issqnRatePercent?: string;
      cityCode?: string;
      asaasApiKey?: string;
      focusApiToken?: string;
    } = {
      taxRegime,
      asaasSandbox,
      focusSandbox,
    };

    if (municipalRegistration.trim().length > 0) payload.municipalRegistration = municipalRegistration.trim();
    if (defaultServiceCode.trim().length > 0) payload.defaultServiceCode = defaultServiceCode.trim();
    if (defaultServiceName.trim().length > 0) payload.defaultServiceName = defaultServiceName.trim();
    if (issqnRatePercent.trim().length > 0) payload.issqnRatePercent = issqnRatePercent.trim();
    if (cityCode.trim().length > 0) payload.cityCode = cityCode.trim();
    if (asaasApiKey.trim().length > 0) payload.asaasApiKey = asaasApiKey.trim();
    if (focusApiToken.trim().length > 0) payload.focusApiToken = focusApiToken.trim();

    await upsertMutation.mutateAsync(payload);
  }

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Dados Fiscais Bento Card */}
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-8 relative overflow-hidden group/fiscal">
        <div className="flex items-center gap-4 relative">
           <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Receipt size={18} strokeWidth={3} />
           </div>
           <div className="flex flex-col gap-0.5">
              <Large className="tracking-tight text-lg font-black uppercase">Parâmetros Tributários</Large>
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Configuração de NFS-e e regimes fiscais</Muted>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
           <div className="flex flex-col gap-1">
              <label className={labelClass}>Inscrição Municipal</label>
              <input className={inputClass} placeholder="000.000-0" value={municipalRegistration} onChange={e => setMunicipalRegistration(e.target.value)} />
           </div>

           <div className="flex flex-col gap-1">
              <label className={labelClass}>Regime de Tributação</label>
              <select 
                value={taxRegime} 
                onChange={e => setTaxRegime(e.target.value as 'simples' | 'lucro_presumido' | 'lucro_real')}
                className={inputClass}
              >
                <option value="simples">Simples Nacional</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
           </div>

           <div className="flex flex-col gap-1">
              <label className={labelClass}>Código de Serviço (LC 116/2003)</label>
              <input className={inputClass} placeholder="Ex: 04.03" value={defaultServiceCode} onChange={e => setDefaultServiceCode(e.target.value)} />
           </div>

           <div className="flex flex-col gap-1">
              <label className={labelClass}>Alíquota ISSQN (%)</label>
              <input className={cn(inputClass, "tabular-nums")} placeholder="0.00" value={issqnRatePercent} onChange={e => setIssqnRatePercent(e.target.value)} />
           </div>

           <div className="flex flex-col gap-1 md:col-span-2">
              <label className={labelClass}>Nome do Serviço Padrão (NFS-e)</label>
              <input className={inputClass} placeholder="Ex: Prótese Dentária sob Encomenda" value={defaultServiceName} onChange={e => setDefaultServiceName(e.target.value)} />
           </div>

           <div className="flex flex-col gap-1">
              <label className={labelClass}>Código IBGE do Município</label>
              <input className={inputClass} placeholder="7 dígitos" value={cityCode} onChange={e => setCityCode(e.target.value)} />
           </div>
        </div>
      </div>

      {/* Integrações Bento Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Asaas Card */}
         <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-6 relative overflow-hidden group/asaas">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shadow-inner">
                     <CreditCard size={18} strokeWidth={3} />
                  </div>
                  <Large className="text-base font-black uppercase tracking-tight">Asaas Gateway</Large>
               </div>
               <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", asaasSandbox ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>
                  {asaasSandbox ? 'Ambiente de Teste' : 'Produção'}
               </div>
            </div>
            
            <div className="flex flex-col gap-4">
               <div className="flex flex-col gap-1">
                  <label className={labelClass}>Chave de API Secundária</label>
                  <input type="password" className={inputClass} placeholder="••••••••••••••••" value={asaasApiKey} onChange={e => setAsaasApiKey(e.target.value)} />
               </div>
               <label className="flex items-center gap-3 cursor-pointer group/toggle">
                  <input type="checkbox" className="sr-only peer" checked={asaasSandbox} onChange={e => setAsaasSandbox(e.target.checked)} />
                  <div className="w-10 h-5 bg-muted rounded-full border border-border peer-checked:bg-amber-500/20 peer-checked:border-amber-500/40 relative transition-all shadow-inner">
                     <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground rounded-full peer-checked:left-6 peer-checked:bg-amber-500 transition-all" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/toggle:text-foreground transition-colors">Ativar Modo Sandbox</span>
               </label>
            </div>
         </div>

         {/* Focus NFe Card */}
         <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-6 relative overflow-hidden group/focus">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                     <Globe size={18} strokeWidth={3} />
                  </div>
                  <Large className="text-base font-black uppercase tracking-tight">Focus NFe API</Large>
               </div>
               <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", focusSandbox ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>
                  {focusSandbox ? 'Ambiente de Teste' : 'Produção'}
               </div>
            </div>
            
            <div className="flex flex-col gap-4">
               <div className="flex flex-col gap-1">
                  <label className={labelClass}>Token de Acesso Focus</label>
                  <input type="password" className={inputClass} placeholder="••••••••••••••••" value={focusApiToken} onChange={e => setFocusApiToken(e.target.value)} />
               </div>
               <label className="flex items-center gap-3 cursor-pointer group/toggle">
                  <input type="checkbox" className="sr-only peer" checked={focusSandbox} onChange={e => setFocusSandbox(e.target.checked)} />
                  <div className="w-10 h-5 bg-muted rounded-full border border-border peer-checked:bg-amber-500/20 peer-checked:border-amber-500/40 relative transition-all shadow-inner">
                     <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground rounded-full peer-checked:left-6 peer-checked:bg-amber-500 transition-all" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/toggle:text-foreground transition-colors">Ativar Modo Sandbox</span>
               </label>
            </div>
         </div>
      </div>

      <div className="flex items-center justify-end gap-4 border-t border-border/50 pt-8 mt-2 relative">
         {upsertMutation.isSuccess && (
           <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase tracking-widest">Configurações Fiscais Efetivadas</span>
           </div>
         )}
         <button
           type="button"
           onClick={handleSave}
           disabled={upsertMutation.isPending}
           className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
         >
           {upsertMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
           Salvar Parâmetros Fiscais
         </button>
      </div>

      {/* Helper Info */}
      <div className="p-6 bg-muted/30 border border-border rounded-[24px] flex items-start gap-4">
         <Info size={18} className="text-primary mt-0.5 shrink-0" />
         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight leading-relaxed opacity-60">
            A configuração fiscal é crítica para a emissão de boletos e notas fiscais de serviço. Certifique-se de que os dados do regime tributário e códigos de serviço estão em conformidade com as orientações do seu contador.
         </p>
      </div>
      
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/fiscal:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
