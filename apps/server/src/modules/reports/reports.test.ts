import { describe, expect, it } from 'vitest';
import { generateReportPdf } from './pdf-engine.js';
import { reportRegistry } from './report-registry.js';
import { serializeReportCsv } from './csv.js';

describe('Reports PDF Engine', () => {
  it('gera buffer de PDF com branding do laboratorio', async () => {
    const pdf = await generateReportPdf({
      labName: 'Lab Teste',
      generatedBy: 'Admin',
      logoUrl: 'https://logo.local/lab.png',
      includeCharts: true,
      report: {
        type: 'monthly_closing',
        title: 'Fechamento Mensal',
        generatedAt: new Date().toISOString(),
        columns: ['cliente', 'totalCents'],
        rows: [
          { cliente: 'Clinica A', totalCents: 10000 },
          { cliente: 'Clinica B', totalCents: 25000 },
        ],
        summary: {
          totalClientes: 2,
          totalCents: 35000,
        },
      },
    });

    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('expoe definicoes fiscais habilitadas no registry', () => {
    const revenue = reportRegistry.find((item) => item.type === 'fiscal-revenue');
    const expenses = reportRegistry.find((item) => item.type === 'fiscal-expenses');
    const dre = reportRegistry.find((item) => item.type === 'fiscal-dre');

    expect(revenue?.enabled).toBe(true);
    expect(expenses?.enabled).toBe(true);
    expect(dre?.enabled).toBe(true);
  });

  it('serializa preview em CSV valido', () => {
    const csv = serializeReportCsv({
      type: 'jobs_by_period',
      title: 'Jobs',
      generatedAt: new Date().toISOString(),
      columns: ['code', 'status'],
      rows: [
        { code: 'OS-001', status: 'pending' },
        { code: 'OS-002', status: 'delivered' },
      ],
      summary: {},
    });

    expect(csv).toContain('code,status');
    expect(csv).toContain('OS-001');
  });
});
