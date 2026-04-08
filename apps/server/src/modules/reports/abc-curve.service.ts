import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
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
        inArray(jobs.status, ['ready', 'delivered', 'completed_with_rework']),
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

