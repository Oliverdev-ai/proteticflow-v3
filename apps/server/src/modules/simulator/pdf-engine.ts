import jsPDF from 'jspdf';

type SimulationPdfLine = {
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCentsSnapshot: number;
  lineTotalCents: number;
};

type SimulationPdfInput = {
  simulationId: number;
  tenantName: string;
  clientName: string;
  totalCents: number;
  createdAt: string;
  lines: SimulationPdfLine[];
};

type JsPdfWithAutoTable = jsPDF & {
  autoTable: (options: unknown) => void;
  lastAutoTable?: { finalY: number };
};

export function generateSimulationBudgetPdf(input: SimulationPdfInput): Buffer {
  const doc = new jsPDF() as JsPdfWithAutoTable;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ProteticFlow - Orcamento', 14, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Laboratorio: ${input.tenantName}`, 14, 30);
  doc.text(`Cliente: ${input.clientName}`, 14, 37);
  doc.text(`Simulacao: #${input.simulationId}`, 14, 44);
  doc.text(`Data: ${new Date(input.createdAt).toLocaleDateString('pt-BR')}`, 14, 51);

  const rows = input.lines.map((line) => ([
    line.serviceNameSnapshot,
    String(line.quantity),
    `R$ ${(line.unitPriceCentsSnapshot / 100).toFixed(2)}`,
    `R$ ${(line.lineTotalCents / 100).toFixed(2)}`,
  ]));

  doc.autoTable({
    startY: 60,
    head: [['Servico', 'Qtd', 'Preco Unit.', 'Total']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  const finalY = doc.lastAutoTable?.finalY ?? 90;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total orcado: R$ ${(input.totalCents / 100).toFixed(2)}`, 14, finalY + 12);

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
}
