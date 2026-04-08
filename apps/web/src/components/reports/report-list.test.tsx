import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportList } from './report-list';

describe('ReportList', () => {
  it('renderiza relatorios disponiveis', () => {
    const html = renderToStaticMarkup(
      <ReportList
        reports={[
          {
            type: 'jobs_by_period',
            title: 'Jobs',
            description: 'Lista de OS',
            outputKind: 'table',
            supportsPdf: true,
            supportsCsv: true,
            supportsEmail: true,
            enabled: true,
          },
          {
            type: 'fiscal-revenue',
            title: 'Faturamento por Periodo',
            description: 'Resumo fiscal',
            outputKind: 'table',
            supportsPdf: true,
            supportsCsv: true,
            supportsEmail: true,
            enabled: true,
          },
        ]}
        selectedType="jobs_by_period"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain('Jobs');
    expect(html).toContain('Faturamento por Periodo');
  });
});
