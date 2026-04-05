import { useMemo, useState } from 'react';
import type { ReportType, ReportPreviewResult } from '@proteticflow/shared';
import { 
  Loader2, AlertCircle, TrendingUp,
  PieChart, Info, Database, CheckCircle2
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { ReportList } from '../../../components/reports/report-list';
import { ReportFilters, type ReportFiltersState } from '../../../components/reports/report-filters';
import { ReportActions } from '../../../components/reports/report-actions';
import { ReportPreviewTable } from '../../../components/reports/report-preview-table';
import { ReportChart } from '../../../components/reports/report-chart';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';

function toIsoRange(date: string, mode: 'start' | 'end') {
  return new Date(`${date}T${mode === 'start' ? '00:00:00' : '23:59:59'}`).toISOString();
}

function downloadBase64(filename: string, mimeType: string, base64: string) {
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportsHubPage() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [email, setEmail] = useState('');
  const [preview, setPreview] = useState<ReportPreviewResult | null>(null);
  const [filters, setFilters] = useState<ReportFiltersState>({
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
    includeCharts: true,
    includeBreakdownByClient: true,
    groupBy: 'month',
  });

  const definitionsQuery = trpc.reports.listDefinitions.useQuery();
  const utils = trpc.useUtils();
  const sendByEmailMutation = trpc.reports.sendByEmail.useMutation();

  const selectedDefinition = useMemo(
    () => definitionsQuery.data?.find((item) => item.type === selectedType) ?? null,
    [definitionsQuery.data, selectedType],
  );

  const requestFilters = useMemo(() => ({
    dateFrom: toIsoRange(filters.dateFrom, 'start'),
    dateTo: toIsoRange(filters.dateTo, 'end'),
    includeCharts: filters.includeCharts,
    includeBreakdownByClient: filters.includeBreakdownByClient,
    groupBy: filters.groupBy,
  }), [filters]);

  async function handlePreview() {
    if (!selectedType) return;
    const result = await utils.reports.preview.fetch({ type: selectedType, filters: requestFilters });
    setPreview(result);
  }

  async function handlePdf() {
    if (!selectedType) return;
    const artifact = await utils.reports.generatePdf.fetch({ type: selectedType, filters: requestFilters });
    downloadBase64(artifact.filename, artifact.mimeType, artifact.base64);
  }

  async function handleCsv() {
    if (!selectedType) return;
    const artifact = await utils.reports.exportCsv.fetch({ type: selectedType, filters: requestFilters });
    downloadBase64(artifact.filename, artifact.mimeType, artifact.base64);
  }

  async function handleSendEmail() {
    if (!selectedType || !email) return;
    await sendByEmailMutation.mutateAsync({
      type: selectedType,
      filters: requestFilters,
      to: email,
      sendCsv: true,
      sendPdf: true,
    });
  }

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-7xl mx-auto pb-16">
      {/* Header Area */}
      <ScaleIn className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <H1 className="tracking-tight">Inteligência de BI</H1>
          <Subtitle>Hub consolidado para auditoria, performance e exportação de dados</Subtitle>
        </div>
        
        <div className="flex items-center gap-4 px-6 py-4 bg-primary/[0.03] border border-primary/20 rounded-3xl shadow-inner">
           <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
              <Database size={20} strokeWidth={2.5} />
           </div>
           <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Status do Vault</span>
              <span className="text-xs font-black text-foreground uppercase tracking-tight flex items-center gap-1.5 leading-none">
                 Sincronizado
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
           </div>
        </div>
      </ScaleIn>

      {/* Global Filter Bar */}
      <ScaleIn delay={0.1}>
        <ReportFilters value={filters} onChange={setFilters} />
      </ScaleIn>

      {/* Error & Loading States */}
      {definitionsQuery.error && (
        <ScaleIn className="premium-card p-8 border-destructive/20 bg-destructive/[0.02] flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-inner border border-destructive/20">
             <AlertCircle size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col gap-0.5">
             <Large className="text-destructive font-black tracking-tight">Falha crítica nas definições</Large>
             <Muted>Erro técnico: {definitionsQuery.error.message}</Muted>
          </div>
        </ScaleIn>
      )}

      {definitionsQuery.isLoading && (
        <ScaleIn className="premium-card p-24 flex flex-col items-center justify-center gap-6">
           <div className="relative">
              <Loader2 className="animate-spin text-primary/30" size={64} strokeWidth={1.5} />
              <TrendingUp className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" size={24} />
           </div>
           <Muted className="font-black uppercase tracking-[0.3em] animate-pulse">Compilando glossário de métricas...</Muted>
        </ScaleIn>
      )}

      {/* Main Analysis Hub */}
      {!definitionsQuery.isLoading && !definitionsQuery.error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar: Report Selection */}
          <div className="lg:col-span-4 sticky top-0">
             <ScaleIn delay={0.2}>
                <ReportList
                  reports={definitionsQuery.data ?? []}
                  selectedType={selectedType}
                  onSelect={setSelectedType}
                />
             </ScaleIn>
          </div>

          {/* Main Area: Actions & Visualization */}
          <div className="lg:col-span-8 flex flex-col gap-8">
             <ScaleIn delay={0.3}>
                <ReportActions
                  disabled={!selectedType || !selectedDefinition?.enabled}
                  email={email}
                  onEmailChange={setEmail}
                  onPreview={handlePreview}
                  onGeneratePdf={handlePdf}
                  onExportCsv={handleCsv}
                  onSendByEmail={handleSendEmail}
                  isSending={sendByEmailMutation.isPending}
                />
             </ScaleIn>

             {/* Dynamic Content: Charts & Tables */}
             <div className="flex flex-col gap-8">
                {preview ? (
                   <>
                      <ScaleIn delay={0.4} key={`chart-${selectedType}`}>
                         <ReportChart preview={preview} />
                      </ScaleIn>
                      <ScaleIn delay={0.5} key={`table-${selectedType}`}>
                         <ReportPreviewTable preview={preview} />
                      </ScaleIn>
                   </>
                ) : (
                   <ScaleIn delay={0.4} className="premium-card p-24 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2 bg-muted/20">
                      <div className="w-20 h-20 flex items-center justify-center rounded-[32px] bg-muted border border-border text-muted-foreground/30 ring-8 ring-muted/10 mb-6">
                        <PieChart size={32} strokeWidth={2.5} />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-sm font-black text-foreground uppercase tracking-widest leading-none">Análise Visual Pendente</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest max-w-xs opacity-60">Selecione um protoclo e acione o preview para carregar a visão consolidada.</p>
                      </div>
                   </ScaleIn>
                )}
             </div>

             {/* Feedback Messages */}
             <div className="relative">
                {sendByEmailMutation.isSuccess && (
                  <ScaleIn className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 shadow-xl shadow-emerald-500/5 animate-bounce">
                     <CheckCircle2 className="text-emerald-500" size={18} strokeWidth={3} />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Relatório enviado com sucesso para {email}</span>
                  </ScaleIn>
                )}
                {sendByEmailMutation.error && (
                  <ScaleIn className="p-5 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3 shadow-xl shadow-destructive/5">
                     <AlertCircle className="text-destructive" size={18} strokeWidth={3} />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">Falha crítica no envio: {sendByEmailMutation.error.message}</span>
                  </ScaleIn>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      {!definitionsQuery.isLoading && (
        <ScaleIn delay={0.6} className="bg-muted/30 border border-border/50 rounded-[32px] p-8 flex items-start gap-6">
           <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <Info size={24} strokeWidth={2.5} />
           </div>
           <div className="flex flex-col gap-2">
              <span className="text-xs font-black text-foreground uppercase tracking-tight leading-none">Protocolo de Segurança e Dados</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed uppercase tracking-tight font-bold opacity-60">
                Todos os relatórios gerados respeitam o isolamento de tenant e criptografia em repouso do ProteticFlow V3. Exportações em CSV seguem o padrão UTF-8 para compatibilidade máxima com Excel e Google Sheets.
              </p>
           </div>
        </ScaleIn>
      )}
    </PageTransition>
  );
}
