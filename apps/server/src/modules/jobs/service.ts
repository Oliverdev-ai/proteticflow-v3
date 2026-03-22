import { eq, and, isNull, ilike, or, sql, count, gt, lt, inArray, not } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { jobs, jobItems, jobLogs, jobStages, jobPhotos, orderCounters } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { priceItems } from '../../db/schema/clients.js';
import { tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
import { canTransition, DEFAULT_STAGES } from '@proteticflow/shared';
import { uploadBuffer, deleteObject } from '../../core/storage.js';
import { autoCreateArFromJob } from '../financial/service.js';
import type {
  createJobSchema,
  updateJobSchema,
  changeStatusSchema,
  listJobsSchema,
  kanbanFiltersSchema,
  createJobStageSchema,
  uploadPhotoSchema,
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

// ─── PAD-04: Order Number com SELECT FOR UPDATE ───────────────────────────────
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// DEVE estar dentro de uma transação já aberta (tx). NÃO usar COUNT(*)+1.
export async function getNextOrderNumber(tx: DbTransaction, tenantId: number): Promise<number> {
  // Upsert do counter
  await tx.execute(sql`
    INSERT INTO order_counters (tenant_id, last_order_number)
    VALUES (${tenantId}, 0)
    ON CONFLICT (tenant_id) DO NOTHING
  `);

  // SELECT FOR UPDATE — bloqueia a linha até o fim da transação
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

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createJob(tenantId: number, input: CreateJobInput, createdBy: number) {
  // 1. Verificar que o cliente pertence ao tenant
  const [client] = await db.select().from(clients).where(
    and(eq(clients.tenantId, tenantId), eq(clients.id, input.clientId), isNull(clients.deletedAt))
  );
  if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });

  const clientAdjustment = Number(client.priceAdjustmentPercent ?? 0);

  const job = await db.transaction(async (tx) => {
    // 2. PAD-04: Gerar número sequencial com lock
    const orderNumber = await getNextOrderNumber(tx, tenantId);
    const code = `OS-${orderNumber.toString().padStart(5, '0')}`;

    // 3. AP-02: Processar itens congelando preços
    let jobTotalCents = 0;
    const processedItems: Array<{
      serviceNameSnapshot: string;
      priceItemId?: number;
      quantity: number;
      unitPriceCents: number;
      adjustmentPercent: number;
      totalCents: number;
    }> = [];

    for (const item of input.items) {
      let unitPriceCents = item.unitPriceCents;
      let serviceNameSnapshot = item.serviceNameSnapshot;

      // AP-02: Se há priceItemId, buscar o preço atual e CONGELAR (copiar)
      if (item.priceItemId) {
        const [priceItem] = await tx.select().from(priceItems).where(
          and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, item.priceItemId))
        );
        if (priceItem) {
          unitPriceCents = priceItem.priceCents; // ← SNAPSHOT, não referência
          serviceNameSnapshot = priceItem.name;
        }
      }

      // Ajuste do item + ajuste do cliente (somados)
      const totalAdjustment = item.adjustmentPercent + clientAdjustment;
      const itemTotal = Math.round(item.quantity * unitPriceCents * (1 + totalAdjustment / 100));
      jobTotalCents += itemTotal;

      processedItems.push({
        serviceNameSnapshot,
        priceItemId: item.priceItemId,
        quantity: item.quantity,
        unitPriceCents,
        adjustmentPercent: item.adjustmentPercent,
        totalCents: itemTotal,
      });
    }

    // 4. Inserir OS
    const [createdJob] = await tx.insert(jobs).values({
      tenantId,
      code,
      orderNumber,
      clientId: input.clientId,
      patientName: input.patientName,
      prothesisType: input.prothesisType,
      material: input.material,
      color: input.color,
      instructions: input.instructions,
      notes: input.notes,
      deadline: new Date(input.deadline),
      assignedTo: input.assignedTo,
      totalCents: jobTotalCents,
      createdBy,
    }).returning();

    // 5. Inserir itens congelados (AP-02)
    for (const item of processedItems) {
      await tx.insert(jobItems).values({
        tenantId,
        jobId: createdJob.id,
        priceItemId: item.priceItemId,
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
      await autoCreateArFromJob(tenantId, createdJob.id, input.clientId, jobTotalCents, new Date(input.deadline), tx);
    }

    // 7. Atualizar contadores do cliente e tenant atomicamente (PAD-01)
    await tx.execute(sql`
      UPDATE clients
      SET total_jobs = total_jobs + 1,
          total_revenue_cents = total_revenue_cents + ${jobTotalCents}
      WHERE id = ${input.clientId} AND tenant_id = ${tenantId}
    `);

    await tx.execute(sql`
      UPDATE tenants
      SET job_count_this_month = job_count_this_month + 1
      WHERE id = ${tenantId}
    `).catch(() => {}); // campo pode não existir ainda em tenants

    logger.info({ action: 'job.create', tenantId, jobId: createdJob.id, orderNumber, clientId: input.clientId, totalCents: jobTotalCents, itemCount: processedItems.length }, 'OS criada');
    return createdJob;
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
    conditions.push(not(inArray(jobs.status, ['delivered', 'cancelled'])));
  }

  const data = await db
    .select({
      id: jobs.id, code: jobs.code, orderNumber: jobs.orderNumber,
      status: jobs.status, totalCents: jobs.totalCents, deadline: jobs.deadline,
      patientName: jobs.patientName, prothesisType: jobs.prothesisType,
      assignedTo: jobs.assignedTo, createdAt: jobs.createdAt,
      clientName: clients.name, clientId: jobs.clientId,
      completedAt: jobs.completedAt, cancelledAt: jobs.cancelledAt,
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
      completedAt: jobs.completedAt, cancelledAt: jobs.cancelledAt, cancelReason: jobs.cancelReason,
      deliveredAt: jobs.deliveredAt, currentStageId: jobs.currentStageId, clientId: jobs.clientId,
      clientName: clients.name, clientPhone: clients.phone, clientEmail: clients.email,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt)));

  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

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
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  const [updated] = await db.update(jobs)
    .set({
      ...input,
      deadline: input.deadline ? new Date(input.deadline) : undefined,
      updatedAt: new Date(),
    })
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
  return updated;
}

export async function changeStatus(tenantId: number, input: ChangeStatusInput, userId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  // Validar transição (PAD-10: status machine)
  if (!canTransition(job.status, input.newStatus)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transição de "${job.status}" para "${input.newStatus}" não permitida`,
    });
  }

  const now = new Date();
  const updates: Partial<typeof jobs.$inferInsert> = {
    status: input.newStatus,
    updatedAt: now,
  };

  // PRD 04.12: setar timestamps automáticos
  if (input.newStatus === 'ready')     updates.completedAt = now;
  if (input.newStatus === 'delivered') updates.deliveredAt = now;
  if (input.newStatus === 'cancelled') {
    updates.cancelledAt = now;
    updates.cancelReason = input.cancelReason;
  }

  await db.transaction(async (tx) => {
    await tx.update(jobs)
      .set(updates)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId)));

    await tx.insert(jobLogs).values({
      tenantId,
      jobId: input.jobId,
      userId,
      fromStatus: job.status,
      toStatus: input.newStatus,
      notes: input.notes ?? input.cancelReason,
    });
  });

  logger.info({ action: 'job.status_change', tenantId, jobId: input.jobId, from: job.status, to: input.newStatus, userId }, 'Status da OS alterado');
  const [updated] = await db.select().from(jobs).where(eq(jobs.id, input.jobId));
  return updated;
}

export async function deleteJob(tenantId: number, jobId: number, deletedBy: number) {
  const [existing] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt))
  );
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  await db.update(jobs)
    .set({ deletedAt: new Date(), deletedBy })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

  logger.info({ action: 'job.delete', tenantId, jobId, userId: deletedBy }, 'OS removida (soft delete)');
}

export async function getLogs(tenantId: number, jobId: number) {
  return db.select().from(jobLogs)
    .where(and(eq(jobLogs.tenantId, tenantId), eq(jobLogs.jobId, jobId)))
    .orderBy(sql`${jobLogs.createdAt} DESC`);
}

// ─── Fotos ────────────────────────────────────────────────────────────────────

export async function uploadPhoto(tenantId: number, input: UploadPhotoInput, uploadedBy: number) {
  // Verificar que job pertence ao tenant
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  // Decodificar base64 e fazer upload (MVP: base64 no body)
  const ext = input.filename.split('.').pop() ?? 'jpg';
  const key = `tenants/${tenantId}/jobs/${input.jobId}/photos/${Date.now()}.${ext}`;

  let url = key; // fallback para dev sem MinIO
  try {
    const buffer = Buffer.from(input.fileBase64, 'base64');
    await uploadBuffer(key, buffer, input.mimeType);
    url = key;
  } catch {
    // MinIO não configurado em dev — salva só o path no banco
    logger.warn({ action: 'job.photo.upload.minio_skip', tenantId, jobId: input.jobId }, 'MinIO não disponível, salvando path local');
  }

  const [photo] = await db.insert(jobPhotos).values({
    tenantId,
    jobId: input.jobId,
    stageId: input.stageId,
    url,
    description: input.description,
    uploadedBy,
  }).returning();

  logger.info({ action: 'job.photo.upload', tenantId, jobId: input.jobId, photoId: photo.id }, 'Foto da OS salva');
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
  if (!photo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Foto não encontrada' });

  try {
    await deleteObject(photo.url);
  } catch {
    // Ignorar erro de S3 se arquivo não existir
  }
  await db.delete(jobPhotos).where(eq(jobPhotos.id, photoId));
}

// ─── Etapas ───────────────────────────────────────────────────────────────────

export async function listStages(tenantId: number) {
  return db.select().from(jobStages)
    .where(and(eq(jobStages.tenantId, tenantId), isNull(jobStages.deletedAt)))
    .orderBy(sql`${jobStages.sortOrder} ASC`);
}

export async function createStage(tenantId: number, input: CreateStageInput) {
  const [stage] = await db.insert(jobStages).values({ tenantId, ...input }).returning();
  return stage;
}

export async function updateStage(tenantId: number, stageId: number, input: Partial<CreateStageInput>) {
  const [updated] = await db.update(jobStages)
    .set(input)
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
  if (existing.length > 0) return; // já seeded

  for (const stage of DEFAULT_STAGES) {
    await db.insert(jobStages).values({ tenantId, name: stage.name, sortOrder: stage.sortOrder });
  }
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

export async function getKanbanBoard(tenantId: number, filters: KanbanFilters) {
  const conditions = [
    eq(jobs.tenantId, tenantId),
    isNull(jobs.deletedAt),
    not(inArray(jobs.status, ['cancelled'])),
  ];

  if (filters.clientId) conditions.push(eq(jobs.clientId, filters.clientId));
  if (filters.assignedTo) conditions.push(eq(jobs.assignedTo, filters.assignedTo));

  const now = new Date();

  const data = await db
    .select({
      id: jobs.id, code: jobs.code, status: jobs.status,
      deadline: jobs.deadline, patientName: jobs.patientName,
      assignedTo: jobs.assignedTo, clientId: jobs.clientId,
      clientName: clients.name, prothesisType: jobs.prothesisType,
      totalCents: jobs.totalCents,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(sql`${jobs.deadline} ASC`);

  // Buscar snapshot do primeiro item de cada job
  const jobIds = data.map(j => j.id);
  const firstItems: Record<number, string> = {};
  if (jobIds.length > 0) {
    const items = await db.select({ jobId: jobItems.jobId, name: jobItems.serviceNameSnapshot })
      .from(jobItems)
      .where(inArray(jobItems.jobId, jobIds))
      .orderBy(sql`${jobItems.id} ASC`);
    for (const item of items) {
      if (!firstItems[item.jobId]) firstItems[item.jobId] = item.name;
    }
  }

  // Agrupar por status + calcular indicadores (05.08)
  const columns: Record<string, typeof data> = {
    pending: [], in_progress: [], quality_check: [], ready: [], delivered: [],
  };

  for (const job of data) {
    const deadline = new Date(job.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    const urgency = diffMs < 0 ? 'overdue' : diffMs < 24 * 60 * 60 * 1000 ? 'due24h' : 'onTime';

    const card = { ...job, firstItemName: firstItems[job.id] ?? '', urgency };

    const col = columns[job.status];
    if (col) col.push(card as typeof data[0]);
  }

  // Se filtro overdue — retornar apenas jobs atrasados
  if (filters.overdue) {
    for (const key of Object.keys(columns)) {
      columns[key] = (columns[key] as Array<typeof data[0] & { urgency: string }>).filter(j => j.urgency === 'overdue') as typeof data;
    }
  }

  return {
    columns: Object.entries(columns).map(([status, jobs]) => ({ status, jobs })),
    total: data.length,
  };
}

export async function moveKanban(tenantId: number, jobId: number, newStatus: string, userId: number) {
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId), isNull(jobs.deletedAt))
  );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  if (!canTransition(job.status, newStatus as Parameters<typeof canTransition>[0])) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transição de "${job.status}" para "${newStatus}" não permitida`,
    });
  }

  const now = new Date();
  const updates: Partial<typeof jobs.$inferInsert> = { status: newStatus as typeof jobs.$inferInsert['status'], updatedAt: now };
  if (newStatus === 'ready')     updates.completedAt = now;
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
  if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'OS não encontrada' });

  await db.transaction(async (tx) => {
    await tx.update(jobs).set({ assignedTo: employeeId ?? undefined, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    await tx.insert(jobLogs).values({
      tenantId, jobId, userId, toStatus: job.status,
      notes: employeeId ? `Atribuído ao técnico #${employeeId}` : 'Técnico removido',
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
      not(inArray(jobs.status, ['delivered', 'cancelled'])),
    ));

  const [overdue] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      lt(jobs.deadline, now),
      not(inArray(jobs.status, ['delivered', 'cancelled'])),
    ));

  const statusBreakdown = await db
    .select({ status: jobs.status, count: count() })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
    .groupBy(jobs.status);

  return {
    activeCount: active?.count ?? 0,
    overdueCount: overdue?.count ?? 0,
    statusBreakdown,
  };
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

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
  doc.text('ProteticFlow — Ordem de Serviço', 14, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS: ${jobData.code}`, 14, 30);
  doc.text(`Cliente: ${jobData.clientName ?? '—'}`, 14, 37);
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
    head: [['Serviço', 'Qtd', 'Preço Unit.', 'Ajuste', 'Total']],
    body: tableRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [124, 58, 237] },
  });

  const finalY = doc.lastAutoTable?.finalY ?? 100;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total: R$ ${(jobData.totalCents / 100).toFixed(2)}`, 14, finalY + 10);

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
}
