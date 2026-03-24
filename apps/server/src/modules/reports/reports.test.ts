import { describe, expect, it } from 'vitest';
import { generateReportPdf } from './pdf-engine.js';

describe('Reports PDF Engine', () => {
  it('gera buffer de PDF com branding do laboratorio', () => {
    const pdf = generateReportPdf({
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
});
