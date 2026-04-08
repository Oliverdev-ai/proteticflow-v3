import { eq, and, isNull, ilike, or, sql, count, gt, lt, inArray, not } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { jobs, jobItems, jobLogs, jobStages, jobPhotos } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { priceItems } from '../../db/schema/clients.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
import { canTransition, DEFAULT_STAGES } from '@proteticflow/shared';
import { uploadBuffer, deleteObject } from '../../core/storage.js';
import { autoCreateArFromJob } from '../financial/service.js';
import { checkLimit, decrementCounter, incrementCounter } from '../licensing/service.js';
import { logAudit } from '../audit/service.js';
import { resolveClientByOsNumber } from './os-blocks.service.js';
import { events } from '../../db/schema/agenda.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import type {
  createJobSchema,
  updateJobSchema,
  changeStatusSchema,
  listJobsSchema,
  kanbanFiltersSchema,
  createJobStageSchema,
  uploadPhotoSchema,
  suspendJobSchema,
  unsuspendJobSchema,
  markProofSchema,
  returnProofSchema,
  createReworkSchema,
  toggleUrgentSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type CreateJobInput    = z.infer<typeof createJobSchema>;
type UpdateJobInput    = z.infer<typeof updateJobSchema>;
type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
type ListJobsInput     = z.infer<typeof listJobsSchema>;
type KanbanFilters     = z.infer<typeof kanbanFiltersSchema>;
type CreateStageInput  = z.infer<typeof createJobStageSchema>;
type UploadPhotoInput  = z.infer<typeof uploadPhotoSchema>;
type SuspendJobInput   = z.infer<typeof suspendJobSchema>;
type UnsuspendJobInput = z.infer<typeof unsuspendJobSchema>;
type MarkProofInput    = z.infer<typeof markProofSchema>;
type ReturnProofInput  = z.infer<typeof returnProofSchema>;
type CreateReworkInput = z.infer<typeof createReworkSchema>;
type ToggleUrgentInput = z.infer<typeof toggleUrgentSchema>;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PAD-04: Order Number com SELECT FOR UPDATE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// DEVE estar dentro de uma transaÃƒÂ§ÃƒÂ£o jÃƒÂ¡ aberta (tx). NÃƒÆ’O usar COUNT(*)+1.
export async function getNextOrderNumber(tx: DbTransaction, tenantId: number): Promise<number> {
  // Upsert do counter
  await tx.execute(sql`
    INSERT INTO order_counters (tenant_id, last_order_number)
    VALUES (${tenantId}, 0)
    ON CONFLICT (tenant_id) DO NOTHING
  `);

  // SELECT FOR UPDATE Ã¢â‚¬â€ bloqueia a linha atÃƒÂ© o fim da transaÃƒÂ§ÃƒÂ£o
  const result = await tx.execute(sql`
    SELECT last_order_number FROM order_counters
    WHERE tenant_id = ${tenantId}
    FOR UPDATE
  `);

  const current = Number((result.rows[0] as { last_order_number: number })?.last_order_number ?? 0);
  const next = current + 1;

  await tx.execute(sql`
    UPDATE order_counters SET last_order_number = ${next}
    WHERE tenant_id = ${tenantId}
  `);

  return next;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CRUD Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function createJob(tenantId: number, input: CreateJobInput, createdBy: number) {
  await checkLimit(tenantId, 'jobsPerMonth', createdBy);

  // 1. Resolver cliente se vier apenas osNumber
  let resolvedClientId = input.clientId;
  if (input.osNumber && !resolvedClientId) {
    const resolved = await resolveClientByOsNumber(tenantId, input.osNumber);
    if (!resolved) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nÃ£o encontrado para este bloco de OS fÃ­sico' });
    }
    resolvedClientId = resolved.clientId;
  }
  if (!resolvedClientId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cliente Ã© obrigatÃ³rio caso o nÃºmero da OS nÃ£o seja resolvÃ­vel' });
  }

  // 1.1 Verificar que o cliente pertence ao tenant
  const [client] = await db.select().from(clients).where(
    and(eq(clients.tenantId, tenantId), eq(clients.id, resolvedClientId), isNull(clients.deletedAt))
  );
  if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nÃ£o encontrado' });

  const clientAdjustment = Number(client.priceAdjustmentPercent ?? 0);

  const job = await db.transaction(async (tx) => {
    // 2. PAD-04: Gerar nÃºmero sequencial interno
    const orderNumberInternal = await getNextOrderNumber(tx, tenantId);
    // Usa o nÃºmero da OS fÃ­sico se existir, senÃ£o gera automÃ¡tico
    const code = input.osNumber 
      ? `OS-${String(input.osNumber).padStart(5, '0')}`
      : `OS-${orderNumberInternal.toString().padStart(5, '0')}`;
    const finalOrderNumber = input.osNumber ?? orderNumberInternal;

    // 3. AP-02: Processar itens congelando preÃƒÂ§os
    let jobTotalCents = 0;
    const processedItems: Array<{
      serviceNameSnapshot: string;
      priceItemId: number | null;
      quantity: number;
      unitPriceCents: number;
      adjustmentPercent: number;
      totalCents: number;
    }> = [];

    for (const item of input.items) {
      let unitPriceCents = item.unitPriceCents;
      let serviceNameSnapshot = item.serviceNameSnapshot;

      // AP-02: Se hÃƒÂ¡ priceItemId, buscar o preÃƒÂ§o atual e CONGELAR (copiar)
      if (item.priceItemId) {
        const [priceItem] = await tx.select().from(priceItems).where(
          and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, item.priceItemId))
        );
        if (priceItem) {
          unitPriceCents = priceItem.priceCents; // Ã¢â€ Â SNAPSHOT, nÃƒÂ£o referÃƒÂªncia
          serviceNameSnapshot = priceItem.name;
        }
      }

      // Ajuste do item + ajuste do cliente (somados)
      const totalAdjustment = item.adjustmentPercent + clientAdjustment;
      const itemTotal = Math.round(item.quantity * unitPriceCents * (1 + totalAdjustment / 100));
      jobTotalCents += itemTotal;

      processedItems.push({
        serviceNameSnapshot,
        priceItemId: item.priceItemId ?? null,
        quantity: item.quantity,
        unitPriceCents,
        adjustmentPercent: item.adjustmentPercent,
        totalCents: itemTotal,
      });
    }

    // 4. Inserir OS
    const [createdJobRow] = await tx.insert(jobs).values({
      tenantId,
      code,
      orderNumber: finalOrderNumber,
      clientId: resolvedClientId!,
      jobSubType: input.jobSubType ?? 'standard',
      isUrgent: input.isUrgent ?? false,
      proofDueDate: input.proofDueDate ? new Date(input.proofDueDate) : null,
      reworkReason: input.reworkReason ?? null,
      reworkParentId: input.reworkParentId ?? null,
      patientName: input.patientName ?? null,
      prothesisType: input.prothesisType ?? null,
      material: input.material ?? null,
      color: input.color ?? null,
      instructions: input.instructions ?? null,
      notes: input.notes ?? null,
      deadline: new Date(input.deadline),
      assignedTo: input.assignedTo ?? null,
      totalCents: jobTotalCents,
      createdBy,
    }).returning();
    const createdJob = createdJobRow!;

    // 5. Inserir itens congelados (AP-02)
    for (const item of processedItems) {
      await tx.insert(jobItems).values({
        tenantId,
        jobId: createdJob.id,
        priceItemId: item.priceItemId ?? null,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        adjustmentPercent: item.adjustmentPercent.toString(),
        totalCents: item.totalCents,
      });
    }

    // 6. Log inicial
    await tx.insert(jobLogs).values({
      tenantId,
      jobId: createdJob.id,
      userId: createdBy,
      fromStatus: null,
      toStatus: 'pending',
      notes: 'OS criada',
    });

    if (jobTotalCents > 0) {
      // 07.01: AR gerado automaticamente ao criar OS
      await autoCreateArFromJob(tenantId, createdJob.id, resolvedClientId!, jobTotalCents, new Date(input.deadline), tx);
    }

    // 7. Atualizar contadores do cliente e tenant atomicamente (PAD-01)
    await tx.execute(sql`
      UPDATE clients
      SET total_jobs = total_jobs + 1,
          total_revenue_cents = total_revenue_cents + ${jobTotalCents}
      WHERE id = ${resolvedClientId!} AND tenant_id = ${tenantId}
    `);

    await incrementCounter(tenantId, 'jobsPerMonth', tx);

    // 8. O.S. Inteligente: Upsert evento de entrega estimada na agenda
    const deadlineDate = new Date(input.deadline);
    const eventData = {
      tenantId,
      title: `Entrega estimada â€” ${code}`,
      type: 'entrega' as const,
      startAt: deadlineDate,
      endAt: new Date(deadlineDate.getTime() + 30 * 60 * 1000), // +30min
      jobId: createdJob.id,
      clientId: resolvedClientId!,
    };
    const [existingEvent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.jobId, createdJob.id)));

    if (existingEvent) {
      await tx
        .update(events)
        .set({ startAt: eventData.startAt, endAt: eventData.endAt, title: eventData.title })
        .where(eq(events.id, existingEvent.id));
    } else {
      await tx.insert(events).values(eventData);
    }

    logger.info({ action: 'job.create', tenantId, jobId: createdJob.id, orderNumber: finalOrderNumber, clientId: resolvedClientId!, totalCents: jobTotalCents, itemCount: processedItems.length }, 'OS criada');
    return createdJob;
  });

  void logAudit({
    tenantId,
    userId: createdBy,
    action: 'job.create',
    entityType: 'jobs',
    entityId: job.id,
    newValue: job,
  });

  return job;
}

export async function listJobs(tenantId: number, filters: ListJobsInput) {
  const conditions = [
    eq(jobs.tenantId, tenantId),
    isNull(jobs.deletedAt),
  ];

  if (filters.status) conditions.push(eq(jobs.status, filters.status));
  if (filters.clientId) conditions.push(eq(jobs.clientId, filters.clientId));
  if (filters.cursor) conditions.push(gt(jobs.id, filters.cursor));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(jobs.code, term), ilike(jobs.patientName, term))!);
  }
  if (filters.overdue) {
    conditions.push(lt(jobs.deadline, new Date()));
    conditions.push(isNull(jobs.suspendedAt));
    conditions.push(not(inArray(jobs.status, ['delivered', 'cancelled', 'completed_with_rework'])));
  }

  const data = await db
    .select({
      id: jobs.id, code: jobs.code, orderNumber: jobs.orderNumber,
      status: jobs.status, totalCents: jobs.totalCents, deadline: jobs.deadline,
      patientName: jobs.patientName, prothesisType: jobs.prothesisType,
      assignedTo: jobs.assignedTo, createdAt: jobs.createdAt,
      clientName: clients.name, clientId: jobs.clientId,
      completedAt: jobs.completedAt, cancelledAt: jobs.cancelledAt,
      jobSubType: jobs.jobSubType, isUrgent: jobs.isUrgent,
      suspendedAt: jobs.suspendedAt, proofDueDate: jobs.proofDueDate, proofReturnedAt: jobs.proofReturnedAt,
      reworkParentId: jobs.reworkParentId,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(sql`${jobs.id} DESC`)
    .limit(filters.limit + 1); // fetch +1 to detect next page

  const hasMore = data.length > filters.limit;
  const items = hasMore ? data.slice(0, filters.limit) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return { data: items, nextCursor };
}

export async function getJob(tenantId: number, jobId: number) {
  const [job] = await db
    .select({
      id: jobs.id, code: jobs.code, orderNumber: jobs.orderNumber,
      status: jobs.status, totalCents: jobs.totalCents, deadline: jobs.deadline,
      patientName: jobs.patientName, prothesisType: jobs.prothesisType,
      material: jobs.material, color: jobs.color, instructions: jobs.instructions,
      notes: jobs.notes, assignedTo: jobs.assignedTo, createdBy: jobs.createdBy,
      createdAt: jobs.createdAt, updatedAt: jobs.updatedAt,
      jobSubType: jobs.jobSubType, isUrgent: jobs.isUrgent,
      suspendedAt: jobs.suspendedAt, suspendedBy: jobs.suspendedBy, suspendReason: jobs.suspendReason,
      proofDueDate: jobs.proofDueDate, proofReturnedAt: jobs.proofReturnedAt,
      reworkReason: jobs.reworkReason, reworkParentId: jobs.reworkParentId,
      completedAt: jobs.completedAt, cancelledAt: jobs.cancelledAt, cancelReason: jobs.cancelReason,
      deliveredAt: jobs.deliveredAt, currentStageId: jobs.currentStageId, clientId: jobs.clientId,
      clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt)));

  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  const [items, logs, photos] = await Promise.all([
    db.select().from(jobItems).where(and(eq(jobItems.tenantId, tenantId), eq(jobItems.jobId, jobId))),
    db.select().from(jobLogs).where(and(eq(jobLogs.tenantId, tenantId), eq(jobLogs.jobId, jobId))).orderBy(sql`${jobLogs.createdAt} DESC`),
    db.select().from(jobPhotos).where(and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.jobId, jobId))).orderBy(sql`${jobPhotos.createdAt} ASC`),
  ]);

  return { ...job, items, logs, photos };
}

export async function updateJob(tenantId: number, jobId: number, input: UpdateJobInput, updatedBy: number) {
  const [existing] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt))
  );
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.jobSubType !== undefined) updateData.jobSubType = input.jobSubType;
  if (input.isUrgent !== undefined) updateData.isUrgent = input.isUrgent;
  if (input.proofDueDate !== undefined) updateData.proofDueDate = input.proofDueDate ? new Date(input.proofDueDate) : null;
  if (input.proofReturnedAt !== undefined) updateData.proofReturnedAt = input.proofReturnedAt ? new Date(input.proofReturnedAt) : null;
  if (input.reworkReason !== undefined) updateData.reworkReason = input.reworkReason;
  if (input.reworkParentId !== undefined) updateData.reworkParentId = input.reworkParentId;
  if (input.patientName !== undefined) updateData.patientName = input.patientName;
  if (input.prothesisType !== undefined) updateData.prothesisType = input.prothesisType;
  if (input.material !== undefined) updateData.material = input.material;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.instructions !== undefined) updateData.instructions = input.instructions;
  if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.deadline !== undefined) updateData.deadline = new Date(input.deadline);

  const [updated] = await db.update(jobs)
    .set(updateData)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId,
    userId: updatedBy,
    toStatus: existing.status,
    notes: 'OS atualizada',
  });

  logger.info({ action: 'job.update', tenantId, jobId, userId: updatedBy }, 'OS atualizada');
  void logAudit({
    tenantId,
    userId: updatedBy,
    action: 'job.update',
    entityType: 'jobs',
    entityId: jobId,
    oldValue: existing,
    newValue: updated,
  });
  return updated;
}

export async function changeStatus(tenantId: number, input: ChangeStatusInput, userId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  // Validar transiÃƒÂ§ÃƒÂ£o (PAD-10: status machine)
  if (!canTransition(job.status, input.newStatus)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `TransiÃƒÂ§ÃƒÂ£o de "${job.status}" para "${input.newStatus}" nÃƒÂ£o permitida`,
    });
  }

  const now = new Date();
  const finalUpdates: Record<string, unknown> = {
    status: input.newStatus,
    updatedAt: now,
  };
  if (input.newStatus === 'ready' || input.newStatus === 'completed_with_rework') finalUpdates.completedAt = now;
  if (input.newStatus === 'delivered') finalUpdates.deliveredAt = now;
  if (input.newStatus === 'cancelled') {
    finalUpdates.cancelledAt = now;
    finalUpdates.cancelReason = input.cancelReason ?? null;
  }

  await db.transaction(async (tx) => {
    await tx.update(jobs)
      .set(finalUpdates)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)));

      await tx.insert(jobLogs).values({
        tenantId,
        jobId: input.jobId,
        userId,
        fromStatus: job.status,
        toStatus: input.newStatus,
        notes: input.notes ?? input.cancelReason ?? null,
      });

      // Se pronto ou entregue, sincronizar rota de entregas (LogÃ­stica AutomÃ¡tica F30)
      if (input.newStatus === 'ready') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Buscar ou criar schedule de hoje
        let [schedule] = await tx.select().from(deliverySchedules)
          .where(and(eq(deliverySchedules.tenantId, tenantId), eq(deliverySchedules.date, today)));
        
        if (!schedule) {
          const [newSchedule] = await tx.insert(deliverySchedules).values({
            tenantId,
            date: today,
            createdBy: userId,
            notes: 'Gerado automaticamente via Status Pronto'
          }).returning();
          schedule = newSchedule!;
        }

        // 2. Upsert no delivery_items para evitar duplicados
        const [existingItem] = await tx.select().from(deliveryItems).where(
          and(eq(deliveryItems.jobId, input.jobId), eq(deliveryItems.scheduleId, schedule.id))
        );

        if (!existingItem) {
          await tx.insert(deliveryItems).values({
            tenantId,
            scheduleId: schedule.id,
            jobId: input.jobId,
            clientId: job.clientId,
            status: 'scheduled'
          });
          logger.info({ action: 'job.logistic_sync', job: job.id, scheduleId: schedule.id }, 'LogÃ­stica sincronizada');
        }
      }
  });

  logger.info({ action: 'job.status_change', tenantId, jobId: input.jobId, from: job.status, to: input.newStatus, userId }, 'Status da OS alterado');
  const [updated] = await db.select().from(jobs).where(eq(jobs.id, input.jobId));
  void logAudit({
    tenantId,
    userId,
    action: 'job.changeStatus',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: { status: job.status },
    newValue: updated,
  });
  return updated;
}

async function getScopedJobOrThrow(tenantId: number, jobId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt)),
  );

  if (!job) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃ£o encontrada' });
  }

  return job;
}

export async function suspendJob(tenantId: number, input: SuspendJobInput, userId: number) {
  const job = await getScopedJobOrThrow(tenantId, input.jobId);

  if (job.suspendedAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS jÃ¡ estÃ¡ suspensa' });
  }

  const now = new Date();
  const [updated] = await db.update(jobs)
    .set({
      suspendedAt: now,
      suspendedBy: userId,
      suspendReason: input.reason,
      updatedAt: now,
    })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId: input.jobId,
    userId,
    fromStatus: job.status,
    toStatus: job.status,
    notes: `OS suspensa: ${input.reason}`,
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.suspend',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: job,
    newValue: updated,
  });

  return updated;
}

export async function unsuspendJob(tenantId: number, input: UnsuspendJobInput, userId: number) {
  const job = await getScopedJobOrThrow(tenantId, input.jobId);

  if (!job.suspendedAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS nÃ£o estÃ¡ suspensa' });
  }

  const [updated] = await db.update(jobs)
    .set({
      suspendedAt: null,
      suspendedBy: null,
      suspendReason: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId: input.jobId,
    userId,
    fromStatus: job.status,
    toStatus: job.status,
    notes: 'OS reativada',
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.unsuspend',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: job,
    newValue: updated,
  });

  return updated;
}

export async function markJobAsProof(tenantId: number, input: MarkProofInput, userId: number) {
  const job = await getScopedJobOrThrow(tenantId, input.jobId);

  if (['delivered', 'cancelled', 'completed_with_rework'].includes(job.status)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS finalizada nÃ£o pode ser marcada como prova' });
  }

  const [updated] = await db.update(jobs)
    .set({
      jobSubType: 'proof',
      proofDueDate: new Date(input.proofDueDate),
      proofReturnedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId: input.jobId,
    userId,
    fromStatus: job.status,
    toStatus: job.status,
    notes: `OS marcada como prova com prazo ${new Date(input.proofDueDate).toISOString()}`,
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.markAsProof',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: job,
    newValue: updated,
  });

  return updated;
}

export async function returnJobProof(tenantId: number, input: ReturnProofInput, userId: number) {
  const job = await getScopedJobOrThrow(tenantId, input.jobId);

  if (job.jobSubType !== 'proof') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS nÃ£o estÃ¡ no fluxo de prova' });
  }

  const [updated] = await db.update(jobs)
    .set({
      jobSubType: 'standard',
      proofReturnedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId: input.jobId,
    userId,
    fromStatus: job.status,
    toStatus: job.status,
    notes: 'Retorno de prova registrado',
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.returnProof',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: job,
    newValue: updated,
  });

  return updated;
}

export async function toggleJobUrgent(tenantId: number, input: ToggleUrgentInput, userId: number) {
  const job = await getScopedJobOrThrow(tenantId, input.jobId);

  const [updated] = await db.update(jobs)
    .set({
      isUrgent: input.isUrgent,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)))
    .returning();

  await db.insert(jobLogs).values({
    tenantId,
    jobId: input.jobId,
    userId,
    fromStatus: job.status,
    toStatus: job.status,
    notes: input.isUrgent ? 'OS marcada como urgente' : 'MarcaÃ§Ã£o de urgÃªncia removida',
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.toggleUrgent',
    entityType: 'jobs',
    entityId: input.jobId,
    oldValue: { isUrgent: job.isUrgent },
    newValue: updated,
  });

  return updated;
}

export async function createReworkJob(tenantId: number, input: CreateReworkInput, userId: number) {
  const original = await getScopedJobOrThrow(tenantId, input.originalJobId);

  if (original.status === 'cancelled') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS cancelada nÃ£o pode gerar remoldagem' });
  }

  const createdRework = await db.transaction(async (tx) => {
    const [originalItems, orderNumberInternal] = await Promise.all([
      tx.select().from(jobItems).where(and(eq(jobItems.tenantId, tenantId), eq(jobItems.jobId, original.id))),
      getNextOrderNumber(tx, tenantId),
    ]);

    if (originalItems.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS original sem itens para copiar' });
    }

    const totalCents = originalItems.reduce((sum, item) => sum + item.totalCents, 0);
    const code = `OS-${orderNumberInternal.toString().padStart(5, '0')}`;

    const [newJob] = await tx.insert(jobs).values({
      tenantId,
      code,
      orderNumber: orderNumberInternal,
      clientId: original.clientId,
      patientName: input.patientName ?? original.patientName,
      prothesisType: input.prothesisType ?? original.prothesisType,
      material: input.material ?? original.material,
      color: input.color ?? original.color,
      instructions: input.instructions ?? original.instructions,
      notes: input.notes ?? original.notes,
      deadline: new Date(input.deadline),
      assignedTo: input.assignedTo ?? original.assignedTo,
      createdBy: userId,
      totalCents,
      jobSubType: 'rework',
      reworkReason: input.reason,
      reworkParentId: original.id,
      isUrgent: original.isUrgent,
    }).returning();

    for (const item of originalItems) {
      await tx.insert(jobItems).values({
        tenantId,
        jobId: newJob!.id,
        priceItemId: item.priceItemId ?? null,
        serviceNameSnapshot: item.serviceNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        adjustmentPercent: item.adjustmentPercent,
        totalCents: item.totalCents,
      });
    }

    await tx.update(jobs)
      .set({
        status: 'completed_with_rework',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, original.id)));

    await tx.insert(jobLogs).values({
      tenantId,
      jobId: original.id,
      userId,
      fromStatus: original.status,
      toStatus: 'completed_with_rework',
      notes: `Remoldagem criada para OS #${newJob!.id}: ${input.reason}`,
    });

    await tx.insert(jobLogs).values({
      tenantId,
      jobId: newJob!.id,
      userId,
      fromStatus: null,
      toStatus: 'pending',
      notes: `OS de remoldagem criada a partir da OS #${original.id}`,
    });

    if (totalCents > 0) {
      await autoCreateArFromJob(
        tenantId,
        newJob!.id,
        original.clientId,
        totalCents,
        new Date(input.deadline),
        tx,
      );
    }

    return newJob!;
  });

  void logAudit({
    tenantId,
    userId,
    action: 'job.createRework',
    entityType: 'jobs',
    entityId: createdRework.id,
    oldValue: { originalJobId: original.id, originalStatus: original.status },
    newValue: createdRework,
  });

  return createdRework;
}

export async function deleteJob(tenantId: number, jobId: number, deletedBy: number) {
  const [existing] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt))
  );
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  await db.transaction(async (tx) => {
    await tx.update(jobs)
      .set({ deletedAt: new Date(), deletedBy })
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
    await decrementCounter(tenantId, 'jobsPerMonth', tx);
  });

  logger.info({ action: 'job.delete', tenantId, jobId, userId: deletedBy }, 'OS removida (soft delete)');
  void logAudit({
    tenantId,
    userId: deletedBy,
    action: 'job.delete',
    entityType: 'jobs',
    entityId: jobId,
    oldValue: existing,
    newValue: { deletedBy },
  });
}

export async function getLogs(tenantId: number, jobId: number) {
  return db.select().from(jobLogs)
    .where(and(eq(jobLogs.tenantId, tenantId), eq(jobLogs.jobId, jobId)))
    .orderBy(sql`${jobLogs.createdAt} DESC`);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Fotos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function uploadPhoto(tenantId: number, input: UploadPhotoInput, uploadedBy: number) {
  // Verificar que job pertence ao tenant
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  // Decodificar base64 e fazer upload (MVP: base64 no body)
  const ext = input.filename.split('.').pop() ?? 'jpg';
  const key = `tenants/${tenantId}/jobs/${input.jobId}/photos/${Date.now()}.${ext}`;

  const buffer = Buffer.from(input.fileBase64, 'base64');
  await uploadBuffer(key, buffer, input.mimeType);
  const url = key;

  const [photo] = await db.insert(jobPhotos).values({
    tenantId,
    jobId: input.jobId,
    stageId: input.stageId ?? null,
    url,
    description: input.description ?? null,
    uploadedBy,
  }).returning();

  logger.info({ action: 'job.photo.upload', tenantId, jobId: input.jobId, photoId: photo!.id }, 'Foto da OS salva');
  return photo;
}

export async function listPhotos(tenantId: number, jobId: number) {
  return db.select().from(jobPhotos)
    .where(and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.jobId, jobId)))
    .orderBy(sql`${jobPhotos.createdAt} ASC`);
}

export async function deletePhoto(tenantId: number, photoId: number) {
  const [photo] = await db.select().from(jobPhotos).where(
    and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.id, photoId))
  );
  if (!photo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Foto nÃƒÂ£o encontrada' });

  try {
    await deleteObject(photo.url);
  } catch {
    // Ignorar erro de S3 se arquivo nÃƒÂ£o existir
  }
  await db.delete(jobPhotos).where(and(eq(jobPhotos.id, photoId), eq(jobPhotos.tenantId, tenantId)));
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Etapas Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function listStages(tenantId: number) {
  return db.select().from(jobStages)
    .where(and(eq(jobStages.tenantId, tenantId), isNull(jobStages.deletedAt)))
    .orderBy(sql`${jobStages.sortOrder} ASC`);
}

export async function createStage(tenantId: number, input: CreateStageInput) {
  const [stage] = await db.insert(jobStages).values({
    tenantId,
    name: input.name,
    sortOrder: input.sortOrder,
    description: input.description ?? null,
  }).returning();
  return stage;
}

export async function updateStage(tenantId: number, stageId: number, input: Partial<CreateStageInput>) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.description !== undefined) updateData.description = input.description;

  const [updated] = await db.update(jobStages)
    .set(updateData)
    .where(and(eq(jobStages.tenantId, tenantId), eq(jobStages.id, stageId)))
    .returning();
  return updated;
}

export async function deleteStage(tenantId: number, stageId: number) {
  await db.update(jobStages)
    .set({ deletedAt: new Date() })
    .where(and(eq(jobStages.tenantId, tenantId), eq(jobStages.id, stageId)));
}

export async function seedDefaultStages(tenantId: number) {
  const existing = await listStages(tenantId);
  if (existing.length > 0) return; // jÃƒÂ¡ seeded

  for (const stage of DEFAULT_STAGES) {
    await db.insert(jobStages).values({ tenantId, name: stage.name, sortOrder: stage.sortOrder });
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Kanban Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function getKanbanBoard(tenantId: number, filters: KanbanFilters) {
  type KanbanCard = {
    id: number;
    code: string;
    status: NonNullable<typeof jobs.$inferSelect['status']>;
    deadline: Date;
    createdAt: Date;
    patientName: string | null;
    assignedTo: number | null;
    clientId: number;
    clientName: string | null;
    prothesisType: string | null;
    jobSubType: 'standard' | 'proof' | 'rework';
    isUrgent: boolean;
    suspendedAt: Date | null;
    suspendReason: string | null;
    proofDueDate: Date | null;
    proofReturnedAt: Date | null;
    reworkParentId: number | null;
    totalCents: number;
    firstItemName: string;
    urgency: 'overdue' | 'due24h' | 'onTime';
  };
  const conditions = [
    eq(jobs.tenantId, tenantId),
    isNull(jobs.deletedAt),
    isNull(jobs.suspendedAt),
    not(inArray(jobs.status, ['cancelled', 'completed_with_rework'])),
  ];

  if (filters.clientId) conditions.push(eq(jobs.clientId, filters.clientId));
  if (filters.assignedTo) conditions.push(eq(jobs.assignedTo, filters.assignedTo));

  const now = new Date();

  const data = await db
    .select({
      id: jobs.id, code: jobs.code, status: jobs.status,
      deadline: jobs.deadline, patientName: jobs.patientName,
      createdAt: jobs.createdAt,
      assignedTo: jobs.assignedTo, clientId: jobs.clientId,
      clientName: clients.name, prothesisType: jobs.prothesisType,
      jobSubType: jobs.jobSubType, isUrgent: jobs.isUrgent,
      suspendedAt: jobs.suspendedAt, suspendReason: jobs.suspendReason,
      proofDueDate: jobs.proofDueDate, proofReturnedAt: jobs.proofReturnedAt,
      reworkParentId: jobs.reworkParentId,
      totalCents: jobs.totalCents,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(sql`${jobs.isUrgent} DESC`, sql`${jobs.deadline} ASC`);

  // Buscar snapshot do primeiro item de cada job
  const jobIds = data.map(j => j.id);
  const firstItems: Record<number, string> = {};
  if (jobIds.length > 0) {
    const items = await db.select({ jobId: jobItems.jobId, name: jobItems.serviceNameSnapshot })
      .from(jobItems)
      .where(and(eq(jobItems.tenantId, tenantId), inArray(jobItems.jobId, jobIds)))
      .orderBy(sql`${jobItems.id} ASC`);
    for (const item of items) {
      if (!firstItems[item.jobId]) firstItems[item.jobId] = item.name;
    }
  }

  // Agrupar por status + calcular indicadores (05.08)
  const columns: Record<'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered', KanbanCard[]> = {
    pending: [], in_progress: [], quality_check: [], ready: [], delivered: [],
  };

  for (const job of data) {
    const deadline = new Date(job.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const urgency = diffMs < 0 ? 'overdue' : diffMs < 24 * 60 * 60 * 1000 ? 'due24h' : 'onTime';

    const card: KanbanCard = {
      ...job,
      firstItemName: firstItems[job.id] ?? '',
      urgency,
    };

    const col = columns[job.status as keyof typeof columns];
    if (col) col.push(card);
  }

  // Se filtro overdue Ã¢â‚¬â€ retornar apenas jobs atrasados
  if (filters.overdue) {
    for (const key of Object.keys(columns) as Array<keyof typeof columns>) {
      columns[key] = columns[key].filter((job) => job.urgency === 'overdue');
    }
  }

  return {
    columns: Object.entries(columns).map(([status, jobs]) => ({ status, jobs })),
    total: data.length,
  };
}

export async function listSuspendedJobs(tenantId: number) {
  return db
    .select({
      id: jobs.id,
      code: jobs.code,
      status: jobs.status,
      jobSubType: jobs.jobSubType,
      isUrgent: jobs.isUrgent,
      patientName: jobs.patientName,
      clientName: clients.name,
      deadline: jobs.deadline,
      suspendedAt: jobs.suspendedAt,
      suspendReason: jobs.suspendReason,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt), not(isNull(jobs.suspendedAt))))
    .orderBy(sql`${jobs.suspendedAt} DESC`);
}

export async function moveKanban(tenantId: number, jobId: number, newStatus: string, userId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });
  if (job.suspendedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'OS suspensa nÃƒÂ£o pode ser movida no Kanban' });

  if (!canTransition(job.status, newStatus as Parameters<typeof canTransition>[0])) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `TransiÃƒÂ§ÃƒÂ£o de "${job.status}" para "${newStatus}" nÃƒÂ£o permitida`,
    });
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    status: newStatus as NonNullable<typeof jobs.$inferInsert['status']>,
    updatedAt: now,
  };
  if (newStatus === 'ready') updates.completedAt = now;
  if (newStatus === 'delivered') updates.deliveredAt = now;

  await db.transaction(async (tx) => {
    await tx.update(jobs).set(updates).where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
    await tx.insert(jobLogs).values({ tenantId, jobId, userId, fromStatus: job.status, toStatus: newStatus, notes: 'Movido no Kanban' });
  });

  logger.info({ action: 'kanban.move', tenantId, jobId, from: job.status, to: newStatus, userId }, 'Card do Kanban movido');
}

export async function assignTechnician(tenantId: number, jobId: number, employeeId: number | null, userId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nÃƒÂ£o encontrada' });

  await db.transaction(async (tx) => {
    await tx.update(jobs).set({ assignedTo: employeeId ?? null, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    await tx.insert(jobLogs).values({
      tenantId, jobId, userId, toStatus: job.status,
      notes: employeeId ? `AtribuÃƒÂ­do ao tÃƒÂ©cnico #${employeeId}` : 'TÃƒÂ©cnico removido',
    });
  });
}

export async function getKanbanMetrics(tenantId: number) {
  const now = new Date();

  const [active] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      isNull(jobs.suspendedAt),
      not(inArray(jobs.status, ['delivered', 'cancelled', 'completed_with_rework'])),
    ));

  const [overdue] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      lt(jobs.deadline, now),
      isNull(jobs.suspendedAt),
      not(inArray(jobs.status, ['delivered', 'cancelled', 'completed_with_rework'])),
    ));

  const [urgentActive] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      isNull(jobs.suspendedAt),
      eq(jobs.isUrgent, true),
      not(inArray(jobs.status, ['delivered', 'cancelled', 'completed_with_rework'])),
    ));

  const [proofOverdue] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      isNull(jobs.suspendedAt),
      eq(jobs.jobSubType, 'proof'),
      isNull(jobs.proofReturnedAt),
      lt(jobs.proofDueDate, now),
      not(inArray(jobs.status, ['delivered', 'cancelled', 'completed_with_rework'])),
    ));

  const statusBreakdown = await db
    .select({ status: jobs.status, count: count() })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
    .groupBy(jobs.status);

  return {
    activeCount: active?.count ?? 0,
    overdueCount: overdue?.count ?? 0,
    urgentActiveCount: urgentActive?.count ?? 0,
    proofOverdueCount: proofOverdue?.count ?? 0,
    statusBreakdown,
  };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ PDF Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function generatePdf(tenantId: number, jobId: number): Promise<Buffer> {
  const jobData = await getJob(tenantId, jobId);

  type JsPdfWithAutoTable = jsPDF & {
    autoTable: (options: unknown) => void;
    lastAutoTable?: { finalY: number };
  };
  const doc = new jsPDF() as JsPdfWithAutoTable;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ProteticFlow Ã¢â‚¬â€ Ordem de ServiÃƒÂ§o', 14, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS: ${jobData.code}`, 14, 30);
  doc.text(`Cliente: ${jobData.clientName ?? 'Ã¢â‚¬â€'}`, 14, 37);
  if (jobData.patientName) doc.text(`Paciente: ${jobData.patientName}`, 14, 44);
  doc.text(`Prazo: ${new Date(jobData.deadline).toLocaleDateString('pt-BR')}`, 14, 51);
  doc.text(`Status: ${jobData.status}`, 14, 58);

  // Tabela de itens
  const tableRows = jobData.items.map(item => [
    item.serviceNameSnapshot,
    String(item.quantity),
    `R$ ${(item.unitPriceCents / 100).toFixed(2)}`,
    `${item.adjustmentPercent}%`,
    `R$ ${(item.totalCents / 100).toFixed(2)}`,
  ]);

  doc.autoTable({
    startY: 68,
    head: [['ServiÃƒÂ§o', 'Qtd', 'PreÃƒÂ§o Unit.', 'Ajuste', 'Total']],
    body: tableRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [124, 58, 237] },
  });

  const finalY = doc.lastAutoTable?.finalY ?? 100;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total: R$ ${(jobData.totalCents / 100).toFixed(2)}`, 14, finalY + 10);

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
}


