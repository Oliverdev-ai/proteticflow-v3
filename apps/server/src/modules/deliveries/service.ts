import { eq, and, gte, lte, sql, desc, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import { jobs, jobLogs } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CreateDeliveryScheduleInput,
  UpdateDeliveryItemStatusInput,
  ListDeliverySchedulesInput,
} from '@proteticflow/shared';

type JsPdfDoc = jsPDF & {
  output(type: 'arraybuffer'): ArrayBuffer;
};

function buildClientAddress(client: {
  clinic?: string | null;
  street: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}): string | null {
  const address = [client.street, client.addressNumber, client.neighborhood, client.city, client.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (address.length > 0) return address.join(', ');

  const clinicAddress = client.clinic?.trim();
  return clinicAddress && clinicAddress.length > 0 ? clinicAddress : null;
}

// ─── Criar Roteiro de Entrega ─────────────────────────────────────────────────

export async function createSchedule(tenantId: number, input: CreateDeliveryScheduleInput, userId: number) {
  return db.transaction(async (tx) => {
    // Validar dados de cada parada
    for (const item of input.items) {
      const [client] = await tx
        .select({
          id: clients.id,
        })
        .from(clients)
        .where(and(eq(clients.id, item.clientId), eq(clients.tenantId, tenantId)));

      if (!client) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cliente #${item.clientId} nao pertence a este tenant`,
        });
      }

      if (item.stopType === 'delivery') {
        if (!item.jobId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parada de entrega exige OS vinculada' });
        }

        const [job] = await tx.select({ id: jobs.id }).from(jobs)
          .where(and(eq(jobs.id, item.jobId), eq(jobs.tenantId, tenantId)));

        if (!job) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `OS #${item.jobId} nao pertence a este tenant`,
          });
        }
      }
    }

    const scheduleData: typeof deliverySchedules.$inferInsert = {
      tenantId,
      date: new Date(input.date),
      createdBy: userId,
    };
    if (input.driverName !== undefined) scheduleData.driverName = input.driverName;
    if (input.vehicle !== undefined) scheduleData.vehicle = input.vehicle;
    if (input.notes !== undefined) scheduleData.notes = input.notes;

    const [schedule] = await tx.insert(deliverySchedules).values(scheduleData).returning();
    if (!schedule) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar roteiro' });

    const itemsData: Array<typeof deliveryItems.$inferInsert> = input.items.map((i) => {
      const itemData: typeof deliveryItems.$inferInsert = {
        tenantId,
        scheduleId: schedule.id,
        stopType: i.stopType,
        jobId: i.jobId ?? null,
        clientId: i.clientId,
        deliveryAddress: i.deliveryAddress,
        sortOrder: i.sortOrder ?? 0,
      };
      if (i.notes !== undefined) itemData.notes = i.notes;
      return itemData;
    });

    const itemsInserted = await tx.insert(deliveryItems).values(itemsData).returning();

    logger.info({ tenantId, scheduleId: schedule.id, itemCount: itemsInserted.length }, 'delivery.schedule.create');
    return { schedule, items: itemsInserted };
  });
}
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
  const [totalRow] = await db.select({ total: sql<number>`count(*)` }).from(deliverySchedules).where(and(...conditions));

  return {
    data: data.map(s => ({ ...s, itemCount: countMap[s.id] ?? 0 })),
    total: Number(totalRow?.total ?? 0),
  };
}

// ─── Detalhe do Roteiro ───────────────────────────────────────────────────────

export async function getSchedule(tenantId: number, scheduleId: number) {
  const [schedule] = await db.select().from(deliverySchedules)
    .where(and(eq(deliverySchedules.id, scheduleId), eq(deliverySchedules.tenantId, tenantId)));
  if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Roteiro não encontrado' });

  const items = await db.select({
    item: deliveryItems,
    jobCode: jobs.code,
    clientName: clients.name,
    clientAddress: sql<string>`coalesce(${deliveryItems.deliveryAddress}, ${clients.street})`,
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
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'failedReason e obrigatorio para status "failed"' });
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: deliveryItems.id,
        jobId: deliveryItems.jobId,
        clientId: deliveryItems.clientId,
        deliveryAddress: deliveryItems.deliveryAddress,
      })
      .from(deliveryItems)
      .where(and(eq(deliveryItems.id, input.itemId), eq(deliveryItems.tenantId, tenantId)));

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Item de entrega nao encontrado' });
    }

    const updateData: Record<string, unknown> = { status: input.status };
    if (input.status === 'delivered') updateData.deliveredAt = new Date();
    if (input.status === 'failed') updateData.failedReason = input.failedReason;
    if (input.notes) updateData.notes = input.notes;

    if (!existing.deliveryAddress) {
      const [client] = await tx
        .select({
          clinic: clients.clinic,
          street: clients.street,
          addressNumber: clients.addressNumber,
          neighborhood: clients.neighborhood,
          city: clients.city,
          state: clients.state,
        })
        .from(clients)
        .where(and(eq(clients.id, existing.clientId), eq(clients.tenantId, tenantId)));
      if (client) {
        const fallbackAddress = buildClientAddress(client);
        if (fallbackAddress) {
          updateData.deliveryAddress = fallbackAddress;
        }
      }
    }

    const [item] = await tx.update(deliveryItems)
      .set(updateData)
      .where(and(eq(deliveryItems.id, input.itemId), eq(deliveryItems.tenantId, tenantId)))
      .returning();

    if (!item) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Item de entrega nao encontrado' });
    }

    // Fluxo inverso: item do roteiro entregue -> OS pronta recebe baixa automaticamente.
    if (input.status === 'delivered' && existing.jobId) {
      const [job] = await tx
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, existing.jobId), eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)));

      if (job && job.status === 'ready') {
        const now = new Date();
        await tx
          .update(jobs)
          .set({ status: 'delivered', deliveredAt: now, updatedAt: now })
          .where(and(eq(jobs.id, job.id), eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)));

        await tx.insert(jobLogs).values({
          tenantId,
          jobId: job.id,
          userId,
          fromStatus: 'ready',
          toStatus: 'delivered',
          notes: 'Baixa automatica via roteiro de entrega',
        });
      }
    }

    logger.info({ tenantId, itemId: input.itemId, status: input.status }, 'delivery.item.status');
    return item;
  });
}
export async function markAllInTransit(tenantId: number, scheduleId: number, _userId: number) {
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
    .where(and(eq(deliveryItems.tenantId, tenantId), inArray(deliveryItems.scheduleId, scheduleIds)));

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
    .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, jobIds)));

  const relevant = rows;
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

  autoTable(doc, {
    startY: 40,
    head: [['#', 'Cliente', 'Endereço', 'Bairro', 'Telefone', 'OS', 'Status']],
    body: rows,
  });

  return Buffer.from(doc.output('arraybuffer'));
}


