import { useState } from 'react';
import { 
  Printer, Network, HardDrive, Save, 
  Loader2, CheckCircle2
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

export function PrinterSettingsForm() {
  const { overview, updatePrinter } = useSettings();
  const printer = overview.data?.printer;

  const [host, setHost] = useState(printer?.printerHost ?? '');
  const [port, setPort] = useState(printer?.printerPort?.toString() ?? '9100');

  const inputClass = "w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/30";
  const labelClass = "text-[10px] font-semibold text-muted-foreground uppercase tracking-normal mb-1.5 ml-1 flex items-center gap-1.5";

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-8 flex flex-col gap-8 relative overflow-hidden group/printer">
       <div className="flex items-center gap-4 relative">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
             <Printer size={18} strokeWidth={3} />
          </div>
          <div className="flex flex-col gap-0.5">
             <Large className="tracking-tight text-lg font-semibold uppercase">Terminal de Impressão</Large>
             <Muted className="text-[10px] font-semibold uppercase tracking-normal opacity-40">Conectividade com hardware térmico local (Zebra/Elgin)</Muted>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="md:col-span-2 flex flex-col gap-1">
             <label className={labelClass}>
                <Network size={12} className="text-primary/40" /> Endereço Host (IP / Hostname)
             </label>
             <input 
               className={inputClass} 
               placeholder="192.168.1.100" 
               value={host} 
               onChange={(e) => setHost(e.target.value)} 
             />
          </div>
          <div className="flex flex-col gap-1">
             <label className={labelClass}>
                <HardDrive size={12} className="text-primary/40" /> Porta TCP
             </label>
             <input 
               className={cn(inputClass, "text-center tabular-nums")} 
               placeholder="9100" 
               value={port} 
               onChange={(e) => setPort(e.target.value)} 
             />
          </div>
       </div>

       <div className="flex items-center justify-end gap-4 border-t border-border/50 pt-6">
          {updatePrinter.isSuccess && (
            <div className="flex items-center gap-2 text-success animate-in fade-in slide-in-from-right-4">
               <CheckCircle2 size={14} strokeWidth={3} />
               <span className="text-[10px] font-semibold uppercase tracking-normal">Sinconizado</span>
            </div>
          )}
          <button
            onClick={() => updatePrinter.mutate({ printerHost: host, printerPort: Number(port) })}
            disabled={updatePrinter.isPending}
            className="flex items-center gap-2.5 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg shadow-lg shadow-sm transition-all hover:brightness-110  disabled:opacity-30 text-[10px] font-semibold uppercase tracking-normal"
          >
            {updatePrinter.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={3} />}
            Efetivar Impressora
          </button>
       </div>

       {/* Decorative backdrop */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover/printer:bg-primary/[0.02] transition-colors duration-1000" />
    </div>
  );
}
