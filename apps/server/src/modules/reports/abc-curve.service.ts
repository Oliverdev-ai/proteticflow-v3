import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../db/index.js';
import { clients } from '../../db/schema/clients.js';
import { jobItems, jobs } from '../../db/schema/jobs.js';
import { materials, stockMovements } from '../../db/schema/materials.js';
import { users } from '../../db/schema/users.js';
import type { AbcCurveInput, AbcCurveType } from './abc-curve.validators.js';

type AbcClassification = 'A' | 'B' | 'C';

type AbcBaseItem = {
  label: string;
  value: number;
};

type AbcItem = AbcBaseItem & {
  percentage: number;
  accumulatedPercentage: number;
  classification: AbcClassification;
};

type AbcSummaryBucket = {
  count: number;
  totalValue: number;
  percentage: number;
};

export type AbcCurveResult = {
  type: AbcCurveType;
  period: {
    start: string;
    end: string;
  };
  totalValue: number;
  items: AbcItem[];
  summary: {
    a: AbcSummaryBucket;
    b: AbcSummaryBucket;
    c: AbcSummaryBucket;
  };
};

type ReportArtifact = {
  filename: string;
  mimeType: string;
  base64: string;
};

const ABC_TYPE_LABELS: Record<AbcCurveType, string> = {
  services: 'Servicos por faturamento',
  clients: 'Dentistas por faturamento',
  materials: 'Materiais por custo',
  technicians: 'Proteticos por volume',
};

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function classifyABC(items: AbcBaseItem[]): { totalValue: number; items: AbcItem[] } {
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);

  if (totalValue <= 0) {
    return {
      totalValue: 0,
      items: items.map((item) => ({
        ...item,
        percentage: 0,
        accumulatedPercentage: 0,
        classification: 'C',
      })),
    };
  }

  let accumulated = 0;
  const classified = items.map((item) => {
    accumulated += item.value;
    const percentage = (item.value / totalValue) * 100;
    const accumulatedPercentage = (accumulated / totalValue) * 100;

    const classification: AbcClassification =
      accumulatedPercentage <= 80 ? 'A' : accumulatedPercentage <= 95 ? 'B' : 'C';

    return {
      ...item,
      percentage: roundTo2(percentage),
      accumulatedPercentage: roundTo2(accumulatedPercentage),
      classification,
    };
  });

  return { totalValue: roundTo2(totalValue), items: classified };
}

function buildSummary(items: AbcItem[], totalValue: number): AbcCurveResult['summary'] {
  const buckets: Record<AbcClassification, AbcSummaryBucket> = {
    A: { count: 0, totalValue: 0, percentage: 0 },
    B: { count: 0, totalValue: 0, percentage: 0 },
    C: { count: 0, totalValue: 0, percentage: 0 },
  };

  for (const item of items) {
    const bucket = buckets[item.classification];
    bucket.count += 1;
    bucket.totalValue += item.value;
  }

  for (const classification of ['A', 'B', 'C'] as const) {
    const bucket = buckets[classification];
    bucket.totalValue = roundTo2(bucket.totalValue);
    bucket.percentage = totalValue > 0 ? roundTo2((bucket.totalValue / totalValue) * 100) : 0;
  }

  return {
    a: buckets.A,
    b: buckets.B,
    c: buckets.C,
  };
}

async function queryServices(tenantId: number, startDate: Date, endDate: Date): Promise<AbcBaseItem[]> {
  const rows = await db
    .select({
      label: jobItems.serviceNameSnapshot,
      value: sql<number>`COALESCE(SUM(${jobItems.totalCents}), 0)::numeric`,
    })
    .from(jobItems)
    .innerJoin(jobs, eq(jobItems.jobId, jobs.id))
    .where(
      and(
        eq(jobItems.tenantId, tenantId),
        eq(jobs.tenantId, tenantId),
        isNull(jobs.deletedAt),
        ne(jobs.status, 'cancelled'),
        gte(jobs.createdAt, startDate),
        lte(jobs.createdAt, endDate),
      ),
    )
    .groupBy(jobItems.serviceNameSnapshot)
    .orderBy(desc(sql`COALESCE(SUM(${jobItems.totalCents}), 0)`));

  return rows
    .map((row) => ({
      label: row.label,
      value: normalizeNumeric(row.value),
    }))
    .filter((row) => row.value > 0);
}

async function queryClients(tenantId: number, startDate: Date, endDate: Date): Promise<AbcBaseItem[]> {
  const rows = await db
    .select({
      clientId: jobs.clientId,
      clientName: clients.name,
      value: sql<number>`COALESCE(SUM(${jobs.totalCents}), 0)::numeric`,
    })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        eq(clients.tenantId, tenantId),
        isNull(jobs.deletedAt),
        isNull(clients.deletedAt),
        ne(jobs.status, 'cancelled'),
        gte(jobs.createdAt, startDate),
        lte(jobs.createdAt, endDate),
      ),
    )
    .groupBy(jobs.clientId, clients.name)
    .orderBy(desc(sql`COALESCE(SUM(${jobs.totalCents}), 0)`));

  return rows
    .map((row) => ({
      label: row.clientName ?? `Cliente #${row.clientId}`,
      value: normalizeNumeric(row.value),
    }))
    .filter((row) => row.value > 0);
}

async function queryMaterials(tenantId: number, startDate: Date, endDate: Date): Promise<AbcBaseItem[]> {
  const rows = await db
    .select({
      materialId: stockMovements.materialId,
      materialName: materials.name,
      value: sql<number>`
        COALESCE(
          SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitCostCents}, 0)),
          0
        )::numeric
      `,
    })
    .from(stockMovements)
    .innerJoin(materials, eq(materials.id, stockMovements.materialId))
    .where(
      and(
        eq(stockMovements.tenantId, tenantId),
        eq(materials.tenantId, tenantId),
        isNull(materials.deletedAt),
        gte(stockMovements.createdAt, startDate),
        lte(stockMovements.createdAt, endDate),
      ),
    )
    .groupBy(stockMovements.materialId, materials.name)
    .orderBy(
      desc(sql`
        COALESCE(
          SUM(ABS(${stockMovements.quantity}) * COALESCE(${stockMovements.unitCostCents}, 0)),
          0
        )
      `),
    );

  return rows
    .map((row) => ({
      label: row.materialName ?? `Material #${row.materialId}`,
      value: normalizeNumeric(row.value),
    }))
    .filter((row) => row.value > 0);
}

async function queryTechnicians(tenantId: number, startDate: Date, endDate: Date): Promise<AbcBaseItem[]> {
  const rows = await db
    .select({
      technicianId: jobs.assignedTo,
      technicianName: users.name,
      value: sql<number>`COUNT(${jobs.id})::int`,
    })
    .from(jobs)
    .leftJoin(users, eq(users.id, jobs.assignedTo))
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        isNull(jobs.deletedAt),
        isNotNull(jobs.assignedTo),
        isNotNull(jobs.completedAt),
        inArray(jobs.status, ['ready', 'delivered']),
        gte(jobs.completedAt, startDate),
        lte(jobs.completedAt, endDate),
      ),
    )
    .groupBy(jobs.assignedTo, users.name)
    .orderBy(desc(sql`COUNT(${jobs.id})`));

  return rows
    .map((row) => ({
      label: row.technicianName ?? `Protetico #${row.technicianId}`,
      value: normalizeNumeric(row.value),
    }))
    .filter((row) => row.value > 0);
}

async function resolveBaseItems(
  tenantId: number,
  type: AbcCurveType,
  startDate: Date,
  endDate: Date,
): Promise<AbcBaseItem[]> {
  if (type === 'services') {
    return queryServices(tenantId, startDate, endDate);
  }
  if (type === 'clients') {
    return queryClients(tenantId, startDate, endDate);
  }
  if (type === 'materials') {
    return queryMaterials(tenantId, startDate, endDate);
  }
  return queryTechnicians(tenantId, startDate, endDate);
}

export async function generateAbcCurveReport(
  tenantId: number,
  input: AbcCurveInput,
): Promise<AbcCurveResult> {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  const baseItems = await resolveBaseItems(tenantId, input.type, startDate, endDate);
  const { totalValue, items } = classifyABC(baseItems);
  const summary = buildSummary(items, totalValue);

  return {
    type: input.type,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totalValue,
    items,
    summary,
  };
}

function formatValueByType(type: AbcCurveType, value: number): string {
  if (type === 'technicians') {
    return value.toLocaleString('pt-BR');
  }

  return (value / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function escapeCsv(value: string | number): string {
  const raw = String(value);
  if (raw.includes(';') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildFileName(type: AbcCurveType, startIso: string, endIso: string, extension: 'csv' | 'pdf'): string {
  const start = startIso.slice(0, 10);
  const end = endIso.slice(0, 10);
  return `curva-abc-${type}-${start}_${end}.${extension}`;
}

export async function exportAbcCurveCsv(tenantId: number, input: AbcCurveInput): Promise<ReportArtifact> {
  const report = await generateAbcCurveReport(tenantId, input);
  const lines: string[] = [];

  lines.push(`Relatorio;Curva ABC`);
  lines.push(`Tipo;${escapeCsv(ABC_TYPE_LABELS[report.type])}`);
  lines.push(`Periodo inicio;${report.period.start.slice(0, 10)}`);
  lines.push(`Periodo fim;${report.period.end.slice(0, 10)}`);
  lines.push(`Total analisado;${escapeCsv(formatValueByType(report.type, report.totalValue))}`);
  lines.push('');
  lines.push('Item;Valor;Percentual (%);Acumulado (%);Classe');

  for (const item of report.items) {
    lines.push(
      [
        escapeCsv(item.label),
        escapeCsv(formatValueByType(report.type, item.value)),
        escapeCsv(item.percentage.toFixed(2)),
        escapeCsv(item.accumulatedPercentage.toFixed(2)),
        item.classification,
      ].join(';'),
    );
  }

  lines.push('');
  lines.push('Resumo;Quantidade;Valor;Percentual (%)');
  lines.push(
    [
      'Classe A',
      report.summary.a.count,
      escapeCsv(formatValueByType(report.type, report.summary.a.totalValue)),
      report.summary.a.percentage.toFixed(2),
    ].join(';'),
  );
  lines.push(
    [
      'Classe B',
      report.summary.b.count,
      escapeCsv(formatValueByType(report.type, report.summary.b.totalValue)),
      report.summary.b.percentage.toFixed(2),
    ].join(';'),
  );
  lines.push(
    [
      'Classe C',
      report.summary.c.count,
      escapeCsv(formatValueByType(report.type, report.summary.c.totalValue)),
      report.summary.c.percentage.toFixed(2),
    ].join(';'),
  );

  const csv = lines.join('\n');

  return {
    filename: buildFileName(report.type, report.period.start, report.period.end, 'csv'),
    mimeType: 'text/csv; charset=utf-8',
    base64: Buffer.from(csv, 'utf-8').toString('base64'),
  };
}

export async function exportAbcCurvePdf(tenantId: number, input: AbcCurveInput): Promise<ReportArtifact> {
  const report = await generateAbcCurveReport(tenantId, input);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Curva ABC', 40, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Tipo: ${ABC_TYPE_LABELS[report.type]}`, 40, 58);
  doc.text(`Periodo: ${report.period.start.slice(0, 10)} ate ${report.period.end.slice(0, 10)}`, 40, 72);
  doc.text(`Total analisado: ${formatValueByType(report.type, report.totalValue)}`, 40, 86);

  autoTable(doc, {
    startY: 104,
    head: [['Item', 'Valor', '%', '% Acumulado', 'Classe']],
    body: report.items.map((item) => [
      item.label,
      formatValueByType(report.type, item.value),
      `${item.percentage.toFixed(2)}%`,
      `${item.accumulatedPercentage.toFixed(2)}%`,
      item.classification,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 41, 55] },
    margin: { left: 40, right: 40 },
  });

  const lastY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumo por classe', 40, lastY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Classe A: ${report.summary.a.count} itens | ${formatValueByType(report.type, report.summary.a.totalValue)} | ${report.summary.a.percentage.toFixed(2)}%`,
    40,
    lastY + 42,
  );
  doc.text(
    `Classe B: ${report.summary.b.count} itens | ${formatValueByType(report.type, report.summary.b.totalValue)} | ${report.summary.b.percentage.toFixed(2)}%`,
    40,
    lastY + 58,
  );
  doc.text(
    `Classe C: ${report.summary.c.count} itens | ${formatValueByType(report.type, report.summary.c.totalValue)} | ${report.summary.c.percentage.toFixed(2)}%`,
    40,
    lastY + 74,
  );

  const buffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer);

  return {
    filename: buildFileName(report.type, report.period.start, report.period.end, 'pdf'),
    mimeType: 'application/pdf',
    base64: buffer.toString('base64'),
  };
}

