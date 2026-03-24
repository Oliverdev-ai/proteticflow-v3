import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { z } from 'zod';
import {
  simulations,
  simulationItems,
  clients,
  priceItems,
  pricingTables,
} from '../../db/schema/index.js';
import { db } from '../../db/index.js';
import {
  createSimulationDraftSchema,
  updateSimulationDraftSchema,
  previewSimulationCalculationSchema,
  compareSimulationTablesSchema,
  listSimulationsSchema,
  approveSimulationAndCreateJobSchema,
} from '@proteticflow/shared';

export type SimulationEngineLineInput = {
  priceItemId: number | null;
  serviceNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  estimatedUnitCostCents: number;
  categorySnapshot?: string | null;
};

export type SimulationEngineInput = {
  lines: SimulationEngineLineInput[];
  clientAdjustmentPercent: number;
  scenarioDiscountPercent: number;
};

export type SimulationEngineResult = {
  subtotalCents: number;
  adjustedSubtotalCents: number;
  totalCents: number;
  estimatedCostCents: number;
  estimatedMarginCents: number;
  estimatedMarginPercent: number;
  lines: Array<{
    priceItemId: number | null;
    serviceNameSnapshot: string;
    quantity: number;
    unitPriceCentsSnapshot: number;
    estimatedUnitCostCentsSnapshot: number;
    lineSubtotalCents: number;
    lineTotalCents: number;
    categorySnapshot: string | null;
  }>;
};

type CompareTableInput = {
  tableId: number;
  pricesByServiceKey: Record<string, number>;
};

type CompareServiceInput = {
  serviceKey: string;
  quantity: number;
};

export type CompareTablesResult = {
  rows: Array<{
    serviceKey: string;
    quantity: number;
    pricesByTable: Record<number, number>;
  }>;
  totalsByTable: Record<number, number>;
};

function roundMoney(value: number) {
  return Math.round(value);
}

function toPercentNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

export function calculateSimulation(input: SimulationEngineInput): SimulationEngineResult {
  const lines = input.lines.map((line) => {
    const lineSubtotalCents = roundMoney(line.quantity * line.unitPriceCents);
    const adjusted = roundMoney(lineSubtotalCents * (1 + input.clientAdjustmentPercent / 100));
    const lineTotalCents = roundMoney(adjusted * (1 - input.scenarioDiscountPercent / 100));

    return {
      priceItemId: line.priceItemId,
      serviceNameSnapshot: line.serviceNameSnapshot,
      categorySnapshot: line.categorySnapshot ?? null,
      quantity: line.quantity,
      unitPriceCentsSnapshot: line.unitPriceCents,
      estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCents,
      lineSubtotalCents,
      lineTotalCents,
      adjustedLineCents: adjusted,
      lineEstimatedCostCents: line.quantity * line.estimatedUnitCostCents,
    };
  });

  const subtotalCents = lines.reduce((acc, line) => acc + line.lineSubtotalCents, 0);
  const adjustedSubtotalCents = lines.reduce((acc, line) => acc + line.adjustedLineCents, 0);
  const totalCents = lines.reduce((acc, line) => acc + line.lineTotalCents, 0);
  const estimatedCostCents = lines.reduce((acc, line) => acc + line.lineEstimatedCostCents, 0);
  const estimatedMarginCents = totalCents - estimatedCostCents;
  const estimatedMarginPercent = totalCents === 0 ? 0 : Number(((estimatedMarginCents / totalCents) * 100).toFixed(2));

  return {
    subtotalCents,
    adjustedSubtotalCents,
    totalCents,
    estimatedCostCents,
    estimatedMarginCents,
    estimatedMarginPercent,
    lines: lines.map((line) => ({
      priceItemId: line.priceItemId,
      serviceNameSnapshot: line.serviceNameSnapshot,
      categorySnapshot: line.categorySnapshot,
      quantity: line.quantity,
      unitPriceCentsSnapshot: line.unitPriceCentsSnapshot,
      estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCentsSnapshot,
      lineSubtotalCents: line.lineSubtotalCents,
      lineTotalCents: line.lineTotalCents,
    })),
  };
}

export function compareTables(
  services: CompareServiceInput[],
  tables: CompareTableInput[],
): CompareTablesResult {
  const rows = services.map((service) => {
    const pricesByTable: Record<number, number> = {};

    for (const table of tables) {
      const unitPrice = table.pricesByServiceKey[service.serviceKey] ?? 0;
      pricesByTable[table.tableId] = roundMoney(service.quantity * unitPrice);
    }

    return {
      serviceKey: service.serviceKey,
      quantity: service.quantity,
      pricesByTable,
    };
  });

  const totalsByTable: Record<number, number> = {};
  for (const table of tables) {
    totalsByTable[table.tableId] = rows.reduce((acc, row) => acc + (row.pricesByTable[table.tableId] ?? 0), 0);
  }

  return { rows, totalsByTable };
}

type CreateDraftInput = z.infer<typeof createSimulationDraftSchema>;
type UpdateDraftInput = z.infer<typeof updateSimulationDraftSchema>;
type PreviewInput = z.infer<typeof previewSimulationCalculationSchema>;
type CompareInput = z.infer<typeof compareSimulationTablesSchema>;
type ListInput = z.infer<typeof listSimulationsSchema>;
type ApproveAndCreateJobInput = z.infer<typeof approveSimulationAndCreateJobSchema>;

async function getClientOrThrow(tenantId: number, clientId: number) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId), isNull(clients.deletedAt)));

  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nao encontrado' });
  }

  return client;
}

async function resolvePricingTableId(tenantId: number, clientPricingTableId: number | null, preferredPricingTableId?: number | null) {
  if (preferredPricingTableId) return preferredPricingTableId;
  if (clientPricingTableId) return clientPricingTableId;

  const [defaultTable] = await db
    .select({ id: pricingTables.id })
    .from(pricingTables)
    .where(and(
      eq(pricingTables.tenantId, tenantId),
      eq(pricingTables.isDefault, true),
      isNull(pricingTables.deletedAt),
    ));

  return defaultTable?.id ?? null;
}

async function resolveEngineLines(
  tenantId: number,
  pricingTableId: number | null,
  inputItems: CreateDraftInput['items'] | UpdateDraftInput['items'] | PreviewInput['items'],
): Promise<SimulationEngineLineInput[]> {
  const itemIds = inputItems
    .map((item) => item.priceItemId)
    .filter((itemId): itemId is number => typeof itemId === 'number');

  const catalogRows = itemIds.length === 0
    ? []
    : await db.select().from(priceItems).where(and(
      eq(priceItems.tenantId, tenantId),
      inArray(priceItems.id, itemIds),
      isNull(priceItems.deletedAt),
    ));

  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));

  return inputItems.map((item) => {
    const catalog = item.priceItemId ? catalogById.get(item.priceItemId) : undefined;

    if (!catalog && item.unitPriceCents === undefined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Item sem preco resolvido (priceItemId=${item.priceItemId ?? 'none'})`,
      });
    }

    if (catalog && pricingTableId && catalog.pricingTableId && catalog.pricingTableId !== pricingTableId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Item ${catalog.id} nao pertence a tabela selecionada`,
      });
    }

    return {
      priceItemId: catalog?.id ?? item.priceItemId ?? null,
      serviceNameSnapshot: item.serviceNameSnapshot ?? catalog?.name ?? 'Servico avulso',
      categorySnapshot: item.categorySnapshot ?? catalog?.category ?? null,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents ?? catalog?.priceCents ?? 0,
      estimatedUnitCostCents: item.estimatedUnitCostCents ?? 0,
    };
  });
}

async function formatSimulationById(tenantId: number, simulationId: number) {
  const [simulation] = await db
    .select()
    .from(simulations)
    .where(and(eq(simulations.tenantId, tenantId), eq(simulations.id, simulationId)));

  if (!simulation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Simulacao nao encontrada' });
  }

  const items = await db
    .select()
    .from(simulationItems)
    .where(and(eq(simulationItems.tenantId, tenantId), eq(simulationItems.simulationId, simulationId)))
    .orderBy(simulationItems.id);

  return {
    id: simulation.id,
    tenantId: simulation.tenantId,
    clientId: simulation.clientId,
    pricingTableId: simulation.pricingTableId,
    status: simulation.status,
    title: simulation.title,
    notes: simulation.notes,
    clientAdjustmentPercent: simulation.clientAdjustmentPercent,
    scenarioDiscountPercent: simulation.scenarioDiscountPercent,
    subtotalCents: simulation.subtotalCents,
    adjustedSubtotalCents: simulation.adjustedSubtotalCents,
    totalCents: simulation.totalCents,
    estimatedCostCents: simulation.estimatedCostCents,
    estimatedMarginCents: simulation.estimatedMarginCents,
    convertedJobId: simulation.convertedJobId,
    sentAt: simulation.sentAt ? simulation.sentAt.toISOString() : null,
    approvedAt: simulation.approvedAt ? simulation.approvedAt.toISOString() : null,
    rejectedAt: simulation.rejectedAt ? simulation.rejectedAt.toISOString() : null,
    createdAt: simulation.createdAt.toISOString(),
    updatedAt: simulation.updatedAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      priceItemId: item.priceItemId,
      serviceNameSnapshot: item.serviceNameSnapshot,
      categorySnapshot: item.categorySnapshot,
      unitPriceCentsSnapshot: item.unitPriceCentsSnapshot,
      estimatedUnitCostCentsSnapshot: item.estimatedUnitCostCentsSnapshot,
      quantity: item.quantity,
      lineSubtotalCents: item.lineSubtotalCents,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

export async function createDraft(tenantId: number, input: CreateDraftInput, userId: number) {
  const client = await getClientOrThrow(tenantId, input.clientId);
  const clientAdjustmentPercent = toPercentNumber(client.priceAdjustmentPercent);
  const pricingTableId = await resolvePricingTableId(tenantId, client.pricingTableId, input.pricingTableId);
  const lines = await resolveEngineLines(tenantId, pricingTableId, input.items);

  const calculation = calculateSimulation({
    lines,
    clientAdjustmentPercent,
    scenarioDiscountPercent: input.scenarioDiscountPercent,
  });

  const [created] = await db.insert(simulations).values({
    tenantId,
    clientId: input.clientId,
    pricingTableId,
    status: 'draft',
    title: input.title ?? null,
    notes: input.notes ?? null,
    clientAdjustmentPercent: String(clientAdjustmentPercent),
    scenarioDiscountPercent: String(input.scenarioDiscountPercent),
    subtotalCents: calculation.subtotalCents,
    adjustedSubtotalCents: calculation.adjustedSubtotalCents,
    totalCents: calculation.totalCents,
    estimatedCostCents: calculation.estimatedCostCents,
    estimatedMarginCents: calculation.estimatedMarginCents,
    createdBy: userId,
    updatedAt: new Date(),
  }).returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar simulacao' });
  }

  if (calculation.lines.length > 0) {
    await db.insert(simulationItems).values(
      calculation.lines.map((line) => ({
        tenantId,
        simulationId: created.id,
        priceItemId: line.priceItemId,
        serviceNameSnapshot: line.serviceNameSnapshot,
        categorySnapshot: line.categorySnapshot,
        unitPriceCentsSnapshot: line.unitPriceCentsSnapshot,
        estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCentsSnapshot,
        quantity: line.quantity,
        lineSubtotalCents: line.lineSubtotalCents,
        lineTotalCents: line.lineTotalCents,
      })),
    );
  }

  return formatSimulationById(tenantId, created.id);
}

export async function updateDraft(tenantId: number, input: UpdateDraftInput) {
  const [existing] = await db
    .select()
    .from(simulations)
    .where(and(eq(simulations.tenantId, tenantId), eq(simulations.id, input.simulationId)));

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Simulacao nao encontrada' });
  }

  if (existing.status !== 'draft') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Somente simulacoes em draft podem ser editadas' });
  }

  const client = await getClientOrThrow(tenantId, existing.clientId);
  const clientAdjustmentPercent = toPercentNumber(client.priceAdjustmentPercent);
  const pricingTableId = input.pricingTableId !== undefined
    ? await resolvePricingTableId(tenantId, client.pricingTableId, input.pricingTableId)
    : existing.pricingTableId;

  const currentItems = await db
    .select()
    .from(simulationItems)
    .where(and(eq(simulationItems.tenantId, tenantId), eq(simulationItems.simulationId, existing.id)));

  const lines = input.items
    ? await resolveEngineLines(tenantId, pricingTableId, input.items)
    : currentItems.map((item) => ({
      priceItemId: item.priceItemId,
      serviceNameSnapshot: item.serviceNameSnapshot,
      categorySnapshot: item.categorySnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCentsSnapshot,
      estimatedUnitCostCents: item.estimatedUnitCostCentsSnapshot,
    }));

  const scenarioDiscountPercent = input.scenarioDiscountPercent ?? toPercentNumber(existing.scenarioDiscountPercent);

  const calculation = calculateSimulation({
    lines,
    clientAdjustmentPercent,
    scenarioDiscountPercent,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(simulations)
      .set({
        pricingTableId,
        title: input.title !== undefined ? input.title : existing.title,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        clientAdjustmentPercent: String(clientAdjustmentPercent),
        scenarioDiscountPercent: String(scenarioDiscountPercent),
        subtotalCents: calculation.subtotalCents,
        adjustedSubtotalCents: calculation.adjustedSubtotalCents,
        totalCents: calculation.totalCents,
        estimatedCostCents: calculation.estimatedCostCents,
        estimatedMarginCents: calculation.estimatedMarginCents,
        updatedAt: new Date(),
      })
      .where(and(eq(simulations.tenantId, tenantId), eq(simulations.id, existing.id)));

    if (input.items) {
      await tx.delete(simulationItems).where(and(
        eq(simulationItems.tenantId, tenantId),
        eq(simulationItems.simulationId, existing.id),
      ));

      if (calculation.lines.length > 0) {
        await tx.insert(simulationItems).values(
          calculation.lines.map((line) => ({
            tenantId,
            simulationId: existing.id,
            priceItemId: line.priceItemId,
            serviceNameSnapshot: line.serviceNameSnapshot,
            categorySnapshot: line.categorySnapshot,
            unitPriceCentsSnapshot: line.unitPriceCentsSnapshot,
            estimatedUnitCostCentsSnapshot: line.estimatedUnitCostCentsSnapshot,
            quantity: line.quantity,
            lineSubtotalCents: line.lineSubtotalCents,
            lineTotalCents: line.lineTotalCents,
          })),
        );
      }
    }
  });

  return formatSimulationById(tenantId, existing.id);
}

export async function previewCalculation(tenantId: number, input: PreviewInput) {
  const client = await getClientOrThrow(tenantId, input.clientId);
  const clientAdjustmentPercent = toPercentNumber(client.priceAdjustmentPercent);
  const pricingTableId = await resolvePricingTableId(tenantId, client.pricingTableId, input.pricingTableId);
  const lines = await resolveEngineLines(tenantId, pricingTableId, input.items);

  return calculateSimulation({
    lines,
    clientAdjustmentPercent,
    scenarioDiscountPercent: input.scenarioDiscountPercent,
  });
}

export async function compareTablesByInput(tenantId: number, input: CompareInput) {
  await getClientOrThrow(tenantId, input.clientId);

  const candidateItems = input.items
    .map((item) => item.priceItemId)
    .filter((itemId): itemId is number => typeof itemId === 'number');

  const mappedRows = candidateItems.length === 0
    ? []
    : await db
      .select({ id: priceItems.id, name: priceItems.name })
      .from(priceItems)
      .where(and(eq(priceItems.tenantId, tenantId), inArray(priceItems.id, candidateItems), isNull(priceItems.deletedAt)));

  const idToName = new Map(mappedRows.map((row) => [row.id, row.name]));

  const serviceList = input.items.map((item) => ({
    serviceKey: normalizeKey(item.serviceNameSnapshot ?? idToName.get(item.priceItemId ?? -1) ?? ''),
    quantity: item.quantity,
  })).filter((row) => row.serviceKey.length > 0);

  if (serviceList.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nao foi possivel resolver os servicos para comparacao' });
  }

  const serviceNames = Array.from(new Set(serviceList.map((service) => service.serviceKey)));

  const allCatalogRows = await db
    .select({
      pricingTableId: priceItems.pricingTableId,
      name: priceItems.name,
      priceCents: priceItems.priceCents,
    })
    .from(priceItems)
    .where(and(
      eq(priceItems.tenantId, tenantId),
      inArray(priceItems.pricingTableId, input.tableIds),
      or(...serviceNames.map((name) => eq(priceItems.name, name)))!,
      isNull(priceItems.deletedAt),
    ));

  const tableMaps = input.tableIds.map((tableId) => {
    const pricesByServiceKey: Record<string, number> = {};

    for (const row of allCatalogRows) {
      if (row.pricingTableId === tableId) {
        pricesByServiceKey[normalizeKey(row.name)] = row.priceCents;
      }
    }

    return { tableId, pricesByServiceKey };
  });

  return compareTables(serviceList, tableMaps);
}

export async function listSimulations(tenantId: number, input: ListInput) {
  const offset = (input.page - 1) * input.limit;

  const conditions = [eq(simulations.tenantId, tenantId)];
  if (input.clientId) conditions.push(eq(simulations.clientId, input.clientId));
  if (input.status) conditions.push(eq(simulations.status, input.status));

  const whereClause = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: simulations.id,
        clientId: simulations.clientId,
        status: simulations.status,
        title: simulations.title,
        totalCents: simulations.totalCents,
        convertedJobId: simulations.convertedJobId,
        createdAt: simulations.createdAt,
      })
      .from(simulations)
      .where(whereClause)
      .orderBy(desc(simulations.createdAt))
      .limit(input.limit)
      .offset(offset),
    db.select({ count: count() }).from(simulations).where(whereClause),
  ]);

  return {
    data: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total: totalResult[0]?.count ?? 0,
  };
}

export async function getSimulation(tenantId: number, simulationId: number) {
  return formatSimulationById(tenantId, simulationId);
}

export async function sendBudgetEmail(tenantId: number, simulationId: number, email: string) {
  const [simulation] = await db
    .select()
    .from(simulations)
    .where(and(eq(simulations.tenantId, tenantId), eq(simulations.id, simulationId)));

  if (!simulation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Simulacao nao encontrada' });
  }

  await db
    .update(simulations)
    .set({
      status: simulation.status === 'draft' ? 'sent' : simulation.status,
      sentAt: simulation.sentAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(simulations.tenantId, tenantId), eq(simulations.id, simulationId)));

  return {
    success: true,
    email,
    simulationId,
  };
}

export async function approveAndCreateJob(
  _tenantId: number,
  _input: ApproveAndCreateJobInput,
  _userId: number,
) {
  throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Conversao para OS sera implementada no bloco T18.4' });
}
