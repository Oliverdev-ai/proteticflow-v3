import { useMemo, useState } from 'react';
import type { ReportType, ReportPreviewResult } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { ReportList } from '../../../components/reports/report-list';
import { ReportFilters, type ReportFiltersState } from '../../../components/reports/report-filters';
import { ReportActions } from '../../../components/reports/report-actions';
import { ReportPreviewTable } from '../../../components/reports/report-preview-table';
import { ReportChart } from '../../../components/reports/report-chart';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatorios</h1>
        <p className="text-sm text-neutral-400">Hub para preview, PDF, CSV e envio por email.</p>
      </div>

      <ReportFilters value={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReportList
          reports={definitionsQuery.data ?? []}
          selectedType={selectedType}
          onSelect={setSelectedType}
        />
        <div className="lg:col-span-2 space-y-6">
          <ReportActions
            disabled={!selectedType || !selectedDefinition?.enabled}
            email={email}
            onEmailChange={setEmail}
            onPreview={handlePreview}
            onGeneratePdf={handlePdf}
            onExportCsv={handleCsv}
            onSendByEmail={handleSendEmail}
          />
          <ReportChart preview={preview} />
          <ReportPreviewTable preview={preview} />
        </div>
      </div>
    </div>
  );
}
