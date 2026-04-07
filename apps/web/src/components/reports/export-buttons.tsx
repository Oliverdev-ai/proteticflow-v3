import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export type FiscalReportId = 'fiscal-revenue' | 'fiscal-expenses' | 'fiscal-dre';

type ExportButtonsProps = {
  reportId: FiscalReportId;
  startDate: string;
  endDate: string;
  disabled?: boolean;
};

type ExportFormat = 'csv' | 'pdf';

function toIsoRange(date: string, mode: 'start' | 'end'): string {
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

export function ExportButtons({ reportId, startDate, endDate, disabled = false }: ExportButtonsProps) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (disabled || loading) {
      return;
    }

    setLoading(format);
    try {
      const input = {
        reportId,
        startDate: toIsoRange(startDate, 'start'),
        endDate: toIsoRange(endDate, 'end'),
      };

      const artifact =
        format === 'csv'
          ? await utils.reports.exportCSV.fetch(input)
          : await utils.reports.exportPDF.fetch(input);

      downloadBase64(artifact.filename, artifact.mimeType, artifact.base64);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => handleExport('csv')}
        disabled={disabled || loading !== null}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
      >
        <FileSpreadsheet size={14} />
        {loading === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}
      </button>
      <button
        onClick={() => handleExport('pdf')}
        disabled={disabled || loading !== null}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
      >
        <Download size={14} />
        {loading === 'pdf' ? 'Exportando PDF...' : 'Exportar PDF'}
      </button>
    </div>
  );
}
