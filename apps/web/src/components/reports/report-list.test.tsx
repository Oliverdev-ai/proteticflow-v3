import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportList } from './report-list';

describe('ReportList', () => {
  it('renderiza relatorios disponiveis e dependencias', () => {
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
            type: 'fiscal',
            title: 'Fiscal',
            description: 'NFS-e e boletos',
            outputKind: 'table',
            supportsPdf: false,
            supportsCsv: false,
            supportsEmail: false,
            enabled: false,
            dependencyNote: 'Dependente de fases futuras',
          },
        ]}
        selectedType="jobs_by_period"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain('Jobs');
    expect(html).toContain('Dependente de fases futuras');
  });
});
