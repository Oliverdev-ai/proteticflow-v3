import { useEffect, useState } from 'react';
import { 
  Palette, Layout, Save, Loader2, CheckCircle2,
  Eye, Layers
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function BrandingForm() {
  const { overview, updateBranding } = useSettings();
  const branding = overview.data?.branding;

  const [reportHeader, setReportHeader] = useState(branding?.reportHeader ?? '');
  const [reportFooter, setReportFooter] = useState(branding?.reportFooter ?? '');
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#1a56db');
  const [secondaryColor, setSecondaryColor] = useState(branding?.secondaryColor ?? '#6b7280');

  useEffect(() => {
    if (!branding) return;
    setReportHeader(branding.reportHeader ?? '');
    setReportFooter(branding.reportFooter ?? '');
    setPrimaryColor(branding.primaryColor ?? '#1a56db');
    setSecondaryColor(branding.secondaryColor ?? '#6b7280');
  }, [branding]);

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-black text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-10 relative overflow-hidden group/brand">
        <div className="flex items-center gap-4 relative">
           <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Palette size={18} strokeWidth={3} />
           </div>
           <div className="flex flex-col gap-0.5">
              <Large className="tracking-tight text-lg font-black uppercase">DNA Visual da Marca</Large>
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Personalização de interface e documentos PDF</Muted>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative">
           {/* Color Palette Section */}
           <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 mb-2">
                 <Layers size={14} className="text-primary/40" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Esquema Cromático</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="flex flex-col gap-3 group/color">
                    <label className={labelClass}>Cor Principal</label>
                    <div className="flex items-center gap-3">
                       <div className="relative">
                          <input 
                            type="color" 
                            value={primaryColor} 
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="w-12 h-12 rounded-xl border-2 border-border shadow-sm group-hover/color:scale-110 transition-transform" style={{ backgroundColor: primaryColor }} />
                       </div>
                       <input className={cn(inputClass, "uppercase")} placeholder="#HEX" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                    </div>
                 </div>

                 <div className="flex flex-col gap-3 group/color">
                    <label className={labelClass}>Cor de Acento</label>
                    <div className="flex items-center gap-3">
                       <div className="relative">
                          <input 
                            type="color" 
                            value={secondaryColor} 
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="w-12 h-12 rounded-xl border-2 border-border shadow-sm group-hover/color:scale-110 transition-transform" style={{ backgroundColor: secondaryColor }} />
                       </div>
                       <input className={cn(inputClass, "uppercase")} placeholder="#HEX" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                    </div>
                 </div>
              </div>
              
              <div className="p-5 bg-muted/20 border border-border rounded-2xl flex items-center gap-4 group/preview overflow-hidden">
                 <div className="flex -space-x-4">
                    <div className="w-10 h-10 rounded-full border-4 border-card shadow-lg z-20 group-hover/preview:translate-x-2 transition-transform" style={{ backgroundColor: primaryColor }} />
                    <div className="w-10 h-10 rounded-full border-4 border-card shadow-lg z-10 group-hover/preview:-translate-x-2 transition-transform" style={{ backgroundColor: secondaryColor }} />
                 </div>
                 <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-foreground">Amostra de Contraste</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground opacity-40 italic">Preview em tempo real</span>
                 </div>
              </div>
           </div>

           {/* PDF Branding Section */}
           <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 mb-2">
                 <Layout size={14} className="text-primary/40" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documentação (PDF)</span>
              </div>
              
              <div className="flex flex-col gap-6">
                 {/* Header PDF */}
                 <div className="flex flex-col gap-1">
                    <label className={labelClass}>Cabeçalho de Relatórios</label>
                    <textarea 
                      className={cn(inputClass, "resize-none h-20 text-[11px] leading-relaxed")} 
                      placeholder="Identificação Superior (Ex: Nome Lab + Unidade)" 
                      value={reportHeader} 
                      onChange={(e) => setReportHeader(e.target.value)} 
                    />
                 </div>

                 {/* Footer PDF */}
                 <div className="flex flex-col gap-1">
                    <label className={labelClass}>Rodapé de Relatórios</label>
                    <textarea 
                      className={cn(inputClass, "resize-none h-20 text-[11px] leading-relaxed")} 
                      placeholder="Identificação Inferior (Ex: Contatos + CRM/CRO)" 
                      value={reportFooter} 
                      onChange={(e) => setReportFooter(e.target.value)} 
                    />
                 </div>
              </div>
           </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-border/50 pt-8 mt-2 relative">
           {updateBranding.isSuccess && (
             <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-4">
                <CheckCircle2 size={16} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase tracking-widest">Branding Sincronizado</span>
             </div>
           )}
           <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-muted rounded-xl border border-border flex items-center gap-2">
                 <Eye size={12} className="text-primary/40" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Preview Global Habilitado</span>
              </div>
              <button
                onClick={() => updateBranding.mutate({ primaryColor, secondaryColor, reportHeader, reportFooter })}
                disabled={updateBranding.isPending}
                className="flex items-center gap-3 bg-primary text-primary-foreground px-10 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
              >
                {updateBranding.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
                Efetivar Brand
              </button>
           </div>
        </div>

        {/* Decorative backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/brand:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
