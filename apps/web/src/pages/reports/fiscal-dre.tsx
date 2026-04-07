import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '../../lib/trpc';
import { ExportButtons } from '../../components/reports/export-buttons';
import { PeriodFilter, type PeriodFilterState } from '../../components/reports/period-filter';
import { PageTransition } from '../../components/shared/page-transition';
import { H1, Subtitle } from '../../components/shared/typography';

function toIsoRange(date: string, mode: 'start' | 'end'): string {
  return new Date(`${date}T${mode === 'start' ? '00:00:00' : '23:59:59'}`).toISOString();
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function FiscalDrePage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [filters, setFilters] = useState<PeriodFilterState>({
    startDate: monthStart.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
  });
  const [submittedFilters, setSubmittedFilters] = useState<PeriodFilterState>(filters);
  const [validationError, setValidationError] = useState('');

  const queryInput = useMemo(
    () => ({
      startDate: toIsoRange(submittedFilters.startDate, 'start'),
      endDate: toIsoRange(submittedFilters.endDate, 'end'),
    }),
    [submittedFilters],
  );

  const query = trpc.reports.fiscalDRE.useQuery(queryInput);

  const chartData = useMemo(
    () =>
      (query.data?.byMonth ?? []).map((item) => ({
        month: item.monthLabel,
        receita: item.grossRevenueCents,
        despesas: item.operatingExpensesCents,
      })),
    [query.data],
  );

  function handleApply() {
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

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-8 overflow-auto p-4 pb-16 md:p-1">
      <div className="space-y-1">
        <H1>DRE Simplificado</H1>
        <Subtitle>Receitas, despesas e resultado liquido no periodo selecionado.</Subtitle>
      </div>

      <PeriodFilter value={filters} onChange={setFilters} onApply={handleApply} isLoading={query.isFetching} />
      <ExportButtons
        reportId="fiscal-dre"
        startDate={submittedFilters.startDate}
        endDate={submittedFilters.endDate}
        disabled={query.isFetching}
      />

      {validationError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {validationError}
        </div>
      )}

      {query.error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar DRE: {query.error.message}
        </div>
      )}

      {query.data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Receita bruta</p>
              <p className="mt-2 text-2xl font-black text-foreground">{formatCurrency(query.data.grossRevenueCents)}</p>
            </div>
            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Despesas</p>
              <p className="mt-2 text-2xl font-black text-foreground">
                {formatCurrency(query.data.operatingExpensesCents)}
              </p>
            </div>
            <div className="premium-card rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado liquido</p>
              <p className="mt-2 text-2xl font-black text-foreground">{formatCurrency(query.data.netResultCents)}</p>
            </div>
          </div>

          <div className="premium-card rounded-2xl p-4 md:p-6">
            <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-foreground">Receita x despesas</h3>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: 'rgb(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="rgb(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="rgb(var(--warning))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="premium-card overflow-hidden rounded-2xl">
            <div className="border-b border-border px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground">
              DRE mensal
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">Mes</th>
                  <th className="px-4 py-2 text-right font-bold">Receita</th>
                  <th className="px-4 py-2 text-right font-bold">Despesas</th>
                  <th className="px-4 py-2 text-right font-bold">Resultado operacional</th>
                  <th className="px-4 py-2 text-right font-bold">Impostos</th>
                  <th className="px-4 py-2 text-right font-bold">Resultado liquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {query.data.byMonth.map((item) => (
                  <tr key={item.month}>
                    <td className="px-4 py-2 font-semibold text-foreground">{item.monthLabel}</td>
                    <td className="px-4 py-2 text-right text-foreground">{formatCurrency(item.grossRevenueCents)}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {formatCurrency(item.operatingExpensesCents)}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">{formatCurrency(item.operatingResultCents)}</td>
                    <td className="px-4 py-2 text-right text-foreground">{formatCurrency(item.taxesCents)}</td>
                    <td className="px-4 py-2 text-right text-foreground">{formatCurrency(item.netResultCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 p-5 text-xs text-muted-foreground">
            Taxa de imposto aplicada: {query.data.taxRatePercent.toFixed(2)}%
          </div>
        </>
      )}

      {!query.isLoading && query.data && query.data.byMonth.length === 0 && (
        <div className="premium-card rounded-2xl border-dashed p-12 text-center text-sm text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-2 font-bold text-foreground">
            <FileText size={16} />
            Sem dados para DRE no periodo
          </div>
          <p>Ajuste o periodo para consultar outro intervalo.</p>
        </div>
      )}
    </PageTransition>
  );
}
