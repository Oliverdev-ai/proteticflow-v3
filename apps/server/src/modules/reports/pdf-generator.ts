import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type FiscalPdfSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

type GenerateFiscalPdfInput = {
  reportTitle: string;
  labName: string;
  logoUrl?: string | null;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  summaryLines: string[];
  sections: FiscalPdfSection[];
};

function formatDateBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTimeBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function imageFormatFromUrl(url: string): 'PNG' | 'JPEG' {
  const extension = url.split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'JPEG' : 'PNG';
}

async function loadLogoAsBase64(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

export async function generateFiscalPdf(input: GenerateFiscalPdfInput): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let cursorY = 56;

  if (input.logoUrl) {
    const logoBase64 = await loadLogoAsBase64(input.logoUrl);
    if (logoBase64) {
      doc.addImage(logoBase64, imageFormatFromUrl(input.logoUrl), 40, 32, 72, 28);
      cursorY = 78;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(input.labName, 40, cursorY);

  doc.setFontSize(12);
  doc.text(input.reportTitle, 40, cursorY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Periodo: ${formatDateBr(input.periodStart)} a ${formatDateBr(input.periodEnd)}`, 40, cursorY + 36);
  doc.text(`Gerado em: ${formatDateTimeBr(input.generatedAt)}`, 40, cursorY + 50);

  let contentY = cursorY + 72;
  if (input.summaryLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Resumo', 40, contentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    input.summaryLines.forEach((line, index) => {
      doc.text(line, 40, contentY + 16 + index * 12);
    });
    contentY += 24 + input.summaryLines.length * 12;
  }

  for (const section of input.sections) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(section.title, 40, contentY);

    autoTable(doc, {
      startY: contentY + 8,
      head: [section.headers],
      body: section.rows,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
    contentY = (lastTable?.finalY ?? contentY + 40) + 20;
  }

  const footerText = `Gerado em ${formatDateTimeBr(input.generatedAt)} - ProteticFlow`;
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(footerText, 40, pageHeight - 20);
    doc.text(`Pagina ${page}/${totalPages}`, pageWidth - 90, pageHeight - 20);
  }

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
}
