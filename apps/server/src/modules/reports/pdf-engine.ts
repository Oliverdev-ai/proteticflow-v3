import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportPreviewResult } from '@proteticflow/shared';

type ReportPdfInput = {
  report: ReportPreviewResult;
  labName: string;
  logoUrl?: string | null;
  generatedBy?: string;
  includeCharts?: boolean;
};

function toCellValue(value: string | number | boolean | null) {
  if (value === null) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  return String(value);
}

export function generateReportPdf(input: ReportPdfInput): Buffer {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(input.labName, 14, 16);

  doc.setFontSize(12);
  doc.text(input.report.title, 14, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Tipo: ${input.report.type}`, 14, 30);
  doc.text(`Gerado em: ${new Date(input.report.generatedAt).toLocaleString('pt-BR')}`, 14, 35);
  if (input.generatedBy) {
    doc.text(`Gerado por: ${input.generatedBy}`, 14, 40);
  }
  if (input.logoUrl) {
    doc.text(`Logo: ${input.logoUrl}`, 14, 45);
  }

  const tableRows = input.report.rows.map((row) => (
    input.report.columns.map((column) => toCellValue(row[column] ?? null))
  ));

  autoTable(doc, {
    startY: input.generatedBy || input.logoUrl ? 50 : 44,
    head: [input.report.columns],
    body: tableRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 70;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', 14, finalY + 10);
  doc.setFont('helvetica', 'normal');

  const summaryLines = Object.entries(input.report.summary).map(([key, value]) => `${key}: ${toCellValue(value)}`);
  summaryLines.forEach((line, index) => {
    doc.text(line, 14, finalY + 16 + index * 5);
  });

  if (input.includeCharts) {
    const chartStartY = finalY + 20 + summaryLines.length * 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Grafico (resumo textual)', 14, chartStartY);
    doc.setFont('helvetica', 'normal');
    summaryLines.forEach((line, index) => {
      doc.text(`- ${line}`, 14, chartStartY + 6 + index * 5);
    });
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.text('ProteticFlow - Relatorio PDF', 14, pageHeight - 8);

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
}
