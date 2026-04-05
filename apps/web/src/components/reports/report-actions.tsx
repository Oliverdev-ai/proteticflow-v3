import { 
  Mail, Download, Table, 
  Eye, Send, Loader2, Activity, Globe, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

type ReportActionsProps = {
  disabled: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onExportCsv: () => void;
  onSendByEmail: () => void;
  isSending?: boolean;
};

export function ReportActions(props: ReportActionsProps) {
  const btnClass = "flex-1 min-w-[140px] flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale shadow-sm";
  
  return (
    <div className="premium-card p-10 flex flex-col gap-10 relative overflow-hidden group">
      <div className="flex items-center gap-4 relative">
         <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
            <Activity size={24} strokeWidth={2.5} />
         </div>
         <div className="flex flex-col gap-0.5">
            <Large className="tracking-tighter">Motor de Exportação</Large>
            <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">Ações e distribuição de inteligência</Muted>
         </div>
      </div>

      <div className="flex flex-col gap-8 relative">
         {/* Action Buttons Row */}
         <div className="flex flex-wrap gap-4">
            <button 
               type="button" 
               onClick={props.onPreview} 
               disabled={props.disabled} 
               className={cn(btnClass, "bg-primary text-primary-foreground shadow-primary/20 hover:brightness-110")}
            >
               <Eye size={16} strokeWidth={3} /> Gerar Preview
            </button>
            <button 
               type="button" 
               onClick={props.onGeneratePdf} 
               disabled={props.disabled} 
               className={cn(btnClass, "bg-muted border border-border text-foreground hover:bg-muted/80 hover:text-primary hover:border-primary/50")}
            >
               <Download size={16} strokeWidth={3} /> Exportar PDF
            </button>
            <button 
               type="button" 
               onClick={props.onExportCsv} 
               disabled={props.disabled} 
               className={cn(btnClass, "bg-muted border border-border text-foreground hover:bg-muted/80 hover:text-emerald-500 hover:border-emerald-500/50")}
            >
               <Table size={16} strokeWidth={3} /> Planilha CSV
            </button>
         </div>

         {/* Email Distribution Section */}
         <div className="flex flex-col gap-4 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2 ml-1">
               <Mail size={14} className="text-primary/50" />
               <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">Distribuição por E-mail</Muted>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
               <div className="flex-1 min-w-[280px] relative group/email">
                  <Globe size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within/email:text-primary transition-colors" />
                  <input
                    type="email"
                    value={props.email}
                    onChange={(event) => props.onEmailChange(event.target.value)}
                    placeholder="destinatario@workflow.com"
                    className="w-full bg-muted/50 border border-border rounded-2xl pl-16 pr-6 py-5 text-sm font-black text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner uppercase tracking-tighter"
                  />
                  {props.email && (
                     <button onClick={() => props.onEmailChange('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/20 hover:text-destructive transition-colors">
                        <X size={16} strokeWidth={3} />
                     </button>
                  )}
               </div>
               
               <button 
                  type="button" 
                  onClick={props.onSendByEmail} 
                  disabled={props.disabled || !props.email || props.isSending} 
                  className="flex items-center justify-center gap-3 px-8 py-5 rounded-2xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 disabled:opacity-30 transition-all min-w-[200px]"
               >
                  {props.isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={3} />}
                  {props.isSending ? 'DISPARANDO...' : 'DISPARAR AGORA'}
               </button>
            </div>
         </div>
      </div>

      {/* Decorative backdrop */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
    </div>
  );
}
