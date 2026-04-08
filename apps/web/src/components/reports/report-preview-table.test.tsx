import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportPreviewTable } from './report-preview-table';

describe('ReportPreviewTable', () => {
  it('renderiza colunas e linhas de preview', () => {
    const html = renderToStaticMarkup(
      <ReportPreviewTable
        preview={{
          type: 'inventory',
          title: 'Estoque',
          generatedAt: new Date().toISOString(),
          columns: ['material', 'currentStock'],
          rows: [{ material: 'Resina', currentStock: 12 }],
          summary: {},
        }}
      />,
    );

    expect(html).toContain('material');
    expect(html).toContain('Resina');
  });
});
