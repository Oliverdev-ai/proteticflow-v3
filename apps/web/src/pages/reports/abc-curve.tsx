import { useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Download, FileSpreadsheet, Layers3, TrendingUp } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { PageTransition } from '../../components/shared/page-transition';
import { H1, Subtitle } from '../../components/shared/typography';
import { AbcChart } from '../../components/reports/abc-chart';
import { AbcFilters, type AbcCurveType, type AbcFiltersState } from '../../components/reports/abc-filters';
import { AbcTable } from '../../components/reports/abc-table';
import { downloadBase64Artifact } from '../../lib/pdf-export';

type AbcDisplayMode = 'currency' | 'count';

const TYPE_LABEL: Record<AbcCurveType, string> = {
  services: 'Servicos por faturamento',
  clients: 'Dentistas por faturamento',
  materials: 'Materiais por custo',
  technicians: 'Proteticos por volume',
};

function toIsoRange(date: string, mode: 'start' | 'end') {
  return new Date(`${date}T${mode === 'start' ? '00:00:00' : '23:59:59'}`).toISOString();
}

function displayMode(type: AbcCurveType): AbcDisplayMode {
  return type === 'technicians' ? 'count' : 'currency';
}

function formatTotal(totalValue: number, mode: AbcDisplayMode): string {
  if (mode === 'currency') {
    return (totalValue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return totalValue.toLocaleString('pt-BR');
}

export default function AbcCurvePage() {
  const utils = trpc.useUtils();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [filters, setFilters] = useState<AbcFiltersState>({
    type: 'services',
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  });
  const [submittedFilters, setSubmittedFilters] = useState<AbcFiltersState>(filters);
  const [validationError, setValidationError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const requestInput = useMemo(
    () => ({
      type: submittedFilters.type,
      startDate: toIsoRange(submittedFilters.startDate, 'start'),
      endDate: toIsoRange(submittedFilters.endDate, 'end'),
    }),
    [submittedFilters],
  );

  const abcQuery = trpc.reports.abcCurve.useQuery(requestInput);

  const mode = displayMode(submittedFilters.type);

  function handleGenerate() {
    if (!filters.startDate || !filters.endDate) {
      setValidationError('Informe inicio e fim do periodo.');
      return;
    }

    if (filters.startDate > filters.endDate) {
      setValidationError('A data inicial nao pode ser maior que a data final.');
      return;
    }

    setValidationError('');
    setSubmittedFilters(filters);
  }

  async function handleExport(format: 'csv' | 'pdf') {
    if (!abcQuery.data || exporting) return;

    setExporting(format);
    try {
      const artifact =
        format === 'csv'
          ? await utils.reports.abcCurveExportCsv.fetch(requestInput)
          : await utils.reports.abcCurveExportPdf.fetch(requestInput);

      downloadBase64Artifact(artifact);
    } finally {
      setExporting(null);
    }
  }

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-8 overflow-auto p-4 pb-16 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1">
          <H1 className="tracking-tight">Curva ABC</H1>
          <Subtitle>
            Analise de Pareto para identificar os itens que concentram o maior impacto operacional e financeiro.
          </Subtitle>
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary">
          <TrendingUp size={14} />
          {TYPE_LABEL[submittedFilters.type]}
        </div>
      </div>

      <AbcFilters value={filters} onChange={setFilters} onGenerate={handleGenerate} isLoading={abcQuery.isFetching} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleExport('csv')}
          disabled={!abcQuery.data || exporting !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          <FileSpreadsheet size={14} />
          {exporting === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}
        </button>
        <button
          type="button"
          onClick={() => handleExport('pdf')}
          disabled={!abcQuery.data || exporting !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
        >
          <Download size={14} />
          {exporting === 'pdf' ? 'Exportando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      {validationError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {validationError}
        </div>
      )}

      {abcQuery.error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao gerar Curva ABC: {abcQuery.error.message}
        </div>
      )}

      {abcQuery.data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total analisado</p>
              <p className="mt-2 text-2xl font-black text-foreground">{formatTotal(abcQuery.data.totalValue, mode)}</p>
            </div>

            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classe A</p>
              <p className="mt-2 text-lg font-black text-primary">
                {abcQuery.data.summary.a.count} itens ({abcQuery.data.summary.a.percentage.toFixed(2)}%)
              </p>
            </div>

            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classe B</p>
              <p className="mt-2 text-lg font-black text-amber-600">
                {abcQuery.data.summary.b.count} itens ({abcQuery.data.summary.b.percentage.toFixed(2)}%)
              </p>
            </div>

            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Classe C</p>
              <p className="mt-2 text-lg font-black text-muted-foreground">
                {abcQuery.data.summary.c.count} itens ({abcQuery.data.summary.c.percentage.toFixed(2)}%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-12">
              <AbcChart items={abcQuery.data.items} mode={mode} />
            </div>
            <div className="xl:col-span-12">
              <AbcTable items={abcQuery.data.items} mode={mode} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-5 text-xs text-muted-foreground">
            <div className="mb-2 inline-flex items-center gap-2 font-black uppercase tracking-widest text-foreground">
              <Layers3 size={14} />
              Regra de classificacao
            </div>
            <p>Ate 80% acumulado = classe A, de 80% a 95% = classe B, acima de 95% = classe C.</p>
          </div>
        </>
      )}

      {abcQuery.isLoading && (
        <div className="premium-card rounded-2xl border-dashed p-12 text-center text-sm text-muted-foreground">
          Gerando Curva ABC...
        </div>
      )}

      {!abcQuery.isLoading && abcQuery.data && abcQuery.data.items.length === 0 && (
        <div className="premium-card rounded-2xl border-dashed p-12 text-center text-sm text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-2 font-bold text-foreground">
            <BarChart3 size={16} />
            Sem dados para o periodo selecionado
          </div>
          <p>Ajuste o periodo ou o tipo de analise para continuar.</p>
        </div>
      )}

      {!validationError && !abcQuery.error && !abcQuery.data && !abcQuery.isLoading && (
        <div className="premium-card rounded-2xl border-dashed p-12 text-center text-sm text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-2 font-bold text-foreground">
            <AlertCircle size={16} />
            Pronto para gerar
          </div>
          <p>Selecione os filtros e clique em "Gerar Relatorio".</p>
        </div>
      )}
    </PageTransition>
  );
}

