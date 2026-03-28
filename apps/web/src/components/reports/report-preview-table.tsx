import type { ReportPreviewResult } from '@proteticflow/shared';

type ReportPreviewTableProps = {
  preview: ReportPreviewResult | null;
};

export function ReportPreviewTable({ preview }: ReportPreviewTableProps) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-500">
        Execute o preview para visualizar os dados do relatorio.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-white">Preview tabular</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-500">
              {preview.columns.map((column) => (
                <th key={column} className="py-2 pr-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, index) => (
              <tr key={index} className="border-b border-neutral-800/60">
                {preview.columns.map((column) => (
                  <td key={column} className="py-2 pr-3 text-neutral-200">{String(row[column] ?? '-')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
