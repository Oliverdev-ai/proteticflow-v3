import type { ReportPreviewResult } from '@proteticflow/shared';
import { Table, Search, Info, Activity } from 'lucide-react';
import { Large, Muted } from '../shared/typography';
import { EmptyState } from '../shared/empty-state';

type ReportPreviewTableProps = {
  preview: ReportPreviewResult | null;
};

export function ReportPreviewTable({ preview }: ReportPreviewTableProps) {
  if (!preview) {
    return (
      <div className="premium-card p-12 border-dashed border-2 flex flex-col items-center justify-center text-center opacity-40">
         <EmptyState 
           icon={Search} 
           title="Preview Indisponível" 
           description="Configure os parâmetros e clique em 'Gerar Preview' para carregar a matriz de dados." 
         />
      </div>
    );
  }

  return (
    <div className="premium-card overflow-hidden group">
      <div className="p-8 border-b border-border/50 bg-card/50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
               <Table size={18} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-0.5">
               <Large className="tracking-tight text-sm font-black uppercase">Matriz de Dados Tabular</Large>
               <Muted className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 italic">Amostra técnica do processamento</Muted>
            </div>
         </div>
         <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
            <Activity size={10} strokeWidth={3} /> {preview.rows.length} Entradas Identificadas
         </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {preview.columns.map((column) => (
                <th key={column} className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5 whitespace-nowrap">
                  {column.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {preview.rows.map((row, index) => (
              <tr key={index} className="group/row hover:bg-primary/[0.01] transition-all">
                {preview.columns.map((column) => (
                  <td key={column} className="px-8 py-5 text-sm font-black text-foreground tracking-tight whitespace-nowrap tabular-nums group-hover/row:text-primary transition-colors">
                    {String(row[column] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6 bg-muted/30 border-t border-border flex items-center gap-3">
         <Info size={14} className="text-primary/40" />
         <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">O preview exibe apenas uma amostra limitada para performance. Utilize a exportação para o conjunto completo.</span>
      </div>
    </div>
  );
}
