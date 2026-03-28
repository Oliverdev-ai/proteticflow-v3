import type { ReportPreviewResult } from '@proteticflow/shared';

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeReportCsv(preview: ReportPreviewResult): string {
  const header = preview.columns.join(',');
  const rows = preview.rows.map((row) => (
    preview.columns
      .map((column) => {
        const value = row[column];
        const normalized = value === null || value === undefined ? '' : String(value);
        return escapeCsv(normalized);
      })
      .join(',')
  ));

  return [header, ...rows].join('\n');
}
