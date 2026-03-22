import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import { jobs } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CreateDeliveryScheduleInput,
  UpdateDeliveryItemStatusInput,
  ListDeliverySchedulesInput,
} from '@proteticflow/shared';

type JsPdfDoc = jsPDF & { autoTable: typeof autoTable };

// ─── Criar Roteiro de Entrega ─────────────────────────────────────────────────

export async function createSchedule(tenantId: number, input: CreateDeliveryScheduleInput, userId: number) {
  return db.transaction(async (tx) => {
    // Validar que todos os jobIds pertencem ao tenant
    for (const item of input.items) {
      const [job] = await tx.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, item.jobId), eq(jobs.tenantId, tenantId)));
      if (!job) throw new TRPCError({ code: 'BAD_REQUEST', message: `OS #${item.jobId} não pertence a este tenant` });
    }

    const [schedule] = await tx.insert(deliverySchedules).values({
      tenantId,
      date: new Date(input.date),
      driverName: input.driverName,
      vehicle: input.vehicle,
      notes: input.notes,
      createdBy: userId,
    }).returning();

    const itemsInserted = await tx.insert(deliveryItems).values(
      input.items.map(i => ({
        tenantId,
        scheduleId: schedule!.id,
        jobId: i.jobId,
        clientId: i.clientId,
        sortOrder: i.sortOrder ?? 0,
        notes: i.notes,
      }))
    ).returning();

    logger.info({ tenantId, scheduleId: schedule!.id, itemCount: itemsInserted.length }, 'delivery.schedule.create');
    return { schedule: schedule!, items: itemsInserted };
  });
}

// ─── Listar Roteiros ──────────────────────────────────────────────────────────

export async function listSchedules(tenantId: number, filters: ListDeliverySchedulesInput) {
  const conditions = [eq(deliverySchedules.tenantId, tenantId)];
  if (filters.dateFrom) conditions.push(gte(deliverySchedules.date, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(deliverySchedules.date, new Date(filters.dateTo)));

  const offset = (filters.page - 1) * filters.limit;
  const data = await db.select().from(deliverySchedules)
    .where(and(...conditions))
    .orderBy(desc(deliverySchedules.date))
    .limit(filters.limit).offset(offset);

  // Count de items por schedule
  const scheduleIds = data.map(s => s.id);
  const itemCounts = scheduleIds.length > 0
    ? await db.select({ scheduleId: deliveryItems.scheduleId, count: sql<number>`count(*)` })
        .from(deliveryItems)
        .where(and(eq(deliveryItems.tenantId, tenantId)))
        .groupBy(deliveryItems.scheduleId)
    : [];

  const countMap = Object.fromEntries(itemCounts.map(r => [r.scheduleId, Number(r.count)]));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(deliverySchedules).where(and(...conditions));

  return {
    data: data.map(s => ({ ...s, itemCount: countMap[s.id] ?? 0 })),
    total: Number(total),
  };
}

// ─── Detalhe do Roteiro ───────────────────────────────────────────────────────

export async function getSchedule(tenantId: number, scheduleId: number) {
  const [schedule] = await db.select().from(deliverySchedules)
    .where(and(eq(deliverySchedules.id, scheduleId), eq(deliverySchedules.tenantId, tenantId)));
  if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Roteiro não encontrado' });

  const items = await db.select({
    item: deliveryItems,
    jobCode: jobs.orderNumber,
    clientName: clients.name,
    clientAddress: clients.address,
    clientPhone: clients.phone,
    clientNeighborhood: clients.neighborhood,
  }).from(deliveryItems)
    .leftJoin(jobs, eq(deliveryItems.jobId, jobs.id))
    .leftJoin(clients, eq(deliveryItems.clientId, clients.id))
    .where(and(eq(deliveryItems.scheduleId, scheduleId), eq(deliveryItems.tenantId, tenantId)))
    .orderBy(deliveryItems.sortOrder);

  return { schedule, items };
}

// ─── Atualizar Status de Item ─────────────────────────────────────────────────

export async function updateItemStatus(tenantId: number, input: UpdateDeliveryItemStatusInput, userId: number) {
  if (input.status === 'failed' && !input.failedReason) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'failedReason é obrigatório para status "failed"' });
  }

  const updateData: Record<string, unknown> = { status: input.status };
  if (input.status === 'delivered') updateData.deliveredAt = new Date();
  if (input.status === 'failed') updateData.failedReason = input.failedReason;
  if (input.notes) updateData.notes = input.notes;

  const [item] = await db.update(deliveryItems)
    .set(updateData)
    .where(and(eq(deliveryItems.id, input.itemId), eq(deliveryItems.tenantId, tenantId)))
    .returning();
  if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item de entrega não encontrado' });

  logger.info({ tenantId, itemId: input.itemId, status: input.status }, 'delivery.item.status');
  return item;
}

// ─── Marcar Todos como Em Trânsito ────────────────────────────────────────────

export async function markAllInTransit(tenantId: number, scheduleId: number, userId: number) {
  await db.update(deliveryItems)
    .set({ status: 'in_transit' })
    .where(and(
      eq(deliveryItems.scheduleId, scheduleId),
      eq(deliveryItems.tenantId, tenantId),
      eq(deliveryItems.status, 'scheduled'),
    ));
}

// ─── Relatório de Entregas (08.09) ────────────────────────────────────────────

export async function getDeliveryReport(tenantId: number, dateFrom: Date, dateTo: Date) {
  const schedules = await db.select({ id: deliverySchedules.id }).from(deliverySchedules)
    .where(and(
      eq(deliverySchedules.tenantId, tenantId),
      gte(deliverySchedules.date, dateFrom),
      lte(deliverySchedules.date, dateTo),
    ));

  const scheduleIds = schedules.map(s => s.id);
  if (scheduleIds.length === 0) return { totalSchedules: 0, totalItems: 0, delivered: 0, failed: 0, successRate: 0 };

  const items = await db.select({ status: deliveryItems.status }).from(deliveryItems)
    .where(and(eq(deliveryItems.tenantId, tenantId)));

  const delivered = items.filter(i => i.status === 'delivered').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const totalItems = items.length;
  const successRate = totalItems > 0 ? Math.round((delivered / totalItems) * 100) : 0;

  return { totalSchedules: schedules.length, totalItems, delivered, failed, successRate };
}

// ─── Agrupamento por Bairro (08.08) ──────────────────────────────────────────

export async function groupByNeighborhood(tenantId: number, jobIds: number[]) {
  if (jobIds.length === 0) return {};

  const rows = await db.select({
    jobId: jobs.id,
    neighborhood: clients.neighborhood,
    clientName: clients.name,
  }).from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.tenantId, tenantId)));

  const relevant = rows.filter(r => jobIds.includes(r.jobId));
  const grouped: Record<string, typeof relevant> = {};
  for (const r of relevant) {
    const key = r.neighborhood ?? 'Sem bairro';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return grouped;
}

// ─── Gerar PDF do Roteiro (08.05) ─────────────────────────────────────────────

export async function generateRoutePdf(tenantId: number, scheduleId: number): Promise<Buffer> {
  const { schedule, items } = await getSchedule(tenantId, scheduleId);
  const doc = new jsPDF() as JsPdfDoc;

  doc.setFontSize(14);
  doc.text(`Roteiro de Entregas — ${new Date(schedule.date).toLocaleDateString('pt-BR')}`, 14, 20);
  if (schedule.driverName) doc.text(`Motorista: ${schedule.driverName}`, 14, 28);
  if (schedule.vehicle) doc.text(`Veículo: ${schedule.vehicle}`, 14, 34);

  const rows = items.map((r, idx) => [
    String(idx + 1),
    r.clientName ?? '-',
    r.clientAddress ?? '-',
    r.clientNeighborhood ?? '-',
    r.clientPhone ?? '-',
    r.jobCode ?? '-',
    r.item.status,
  ]);

  doc.autoTable({
    startY: 40,
    head: [['#', 'Cliente', 'Endereço', 'Bairro', 'Telefone', 'OS', 'Status']],
    body: rows,
  });

  return Buffer.from(doc.output('arraybuffer'));
}
