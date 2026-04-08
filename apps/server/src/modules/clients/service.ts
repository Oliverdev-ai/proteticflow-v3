import { eq, and, isNull, ilike, or, sql, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { clients } from '../../db/schema/clients.js';
import { jobs } from '../../db/schema/jobs.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
import { checkLimit, decrementCounter, incrementCounter } from '../licensing/service.js';
import { logAudit } from '../audit/service.js';
import type {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';

type CreateClientInput = z.infer<typeof createClientSchema>;
type UpdateClientInput = z.infer<typeof updateClientSchema>;
type ListClientsInput = z.infer<typeof listClientsSchema>;

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createClient(tenantId: number, input: CreateClientInput, createdBy: number) {
  await checkLimit(tenantId, 'clients', createdBy);

  const [client] = await db.transaction(async (tx) => {
    const clientData: typeof clients.$inferInsert = {
      tenantId,
      createdBy,
      name: input.name,
      priceAdjustmentPercent: input.priceAdjustmentPercent?.toString() ?? '0',
    };
    if (input.clinic !== undefined) clientData.clinic = input.clinic;
    if (input.email !== undefined) clientData.email = input.email;
    if (input.phone !== undefined) clientData.phone = input.phone;
    if (input.phone2 !== undefined) clientData.phone2 = input.phone2;
    if (input.documentType !== undefined) clientData.documentType = input.documentType;
    if (input.document !== undefined) clientData.document = input.document;
    if (input.contactPerson !== undefined) clientData.contactPerson = input.contactPerson;
    if (input.street !== undefined) clientData.street = input.street;
    if (input.addressNumber !== undefined) clientData.addressNumber = input.addressNumber;
    if (input.complement !== undefined) clientData.complement = input.complement;
    if (input.neighborhood !== undefined) clientData.neighborhood = input.neighborhood;
    if (input.city !== undefined) clientData.city = input.city;
    if (input.state !== undefined) clientData.state = input.state;
    if (input.zipCode !== undefined) clientData.zipCode = input.zipCode;
    if (input.technicalPreferences !== undefined) clientData.technicalPreferences = input.technicalPreferences;
    if (input.pricingTableId !== undefined) clientData.pricingTableId = input.pricingTableId;

    const [c] = await tx.insert(clients).values(clientData).returning();
    if (!c) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar cliente' });

    await incrementCounter(tenantId, 'clients', tx);

    return [c];
  });

  if (!client) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar cliente' });
  logger.info({ action: 'client.create', tenantId, clientId: client.id, userId: createdBy }, 'Cliente criado');
  void logAudit({
    tenantId,
    userId: createdBy,
    action: 'client.create',
    entityType: 'clients',
    entityId: client.id,
    newValue: client,
  });
  return client;
}

export async function listClients(tenantId: number, filters: ListClientsInput) {
  const offset = (filters.page - 1) * filters.limit;

  const conditions = [
    eq(clients.tenantId, tenantId),
    isNull(clients.deletedAt),
  ];

  if (filters.status) {
    conditions.push(eq(clients.status, filters.status));
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(clients.name, term),
        ilike(clients.document, term),
        ilike(clients.phone, term),
      )!
    );
  }

  const whereClause = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db.select().from(clients).where(whereClause).limit(filters.limit).offset(offset),
    db.select({ count: count() }).from(clients).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getClient(tenantId: number, clientId: number) {
  const [client] = await db.select().from(clients).where(
    and(eq(clients.tenantId, tenantId), eq(clients.id, clientId), isNull(clients.deletedAt))
  );
  if (!client) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
  }
  return client;
}

export async function updateClient(tenantId: number, clientId: number, input: UpdateClientInput, updatedBy: number) {
  const existing = await getClient(tenantId, clientId); // valida isolamento

  const updates: Partial<typeof clients.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updates.name = input.name;
  if (input.clinic !== undefined) updates.clinic = input.clinic;
  if (input.email !== undefined) updates.email = input.email;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.phone2 !== undefined) updates.phone2 = input.phone2;
  if (input.documentType !== undefined) updates.documentType = input.documentType;
  if (input.document !== undefined) updates.document = input.document;
  if (input.contactPerson !== undefined) updates.contactPerson = input.contactPerson;
  if (input.street !== undefined) updates.street = input.street;
  if (input.addressNumber !== undefined) updates.addressNumber = input.addressNumber;
  if (input.complement !== undefined) updates.complement = input.complement;
  if (input.neighborhood !== undefined) updates.neighborhood = input.neighborhood;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;
  if (input.zipCode !== undefined) updates.zipCode = input.zipCode;
  if (input.technicalPreferences !== undefined) updates.technicalPreferences = input.technicalPreferences;
  if (input.priceAdjustmentPercent !== undefined) updates.priceAdjustmentPercent = input.priceAdjustmentPercent.toString();
  if (input.pricingTableId !== undefined) updates.pricingTableId = input.pricingTableId;

  const [updated] = await db.update(clients)
    .set(updates)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)))
    .returning();
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nÃ£o encontrado' });

  logger.info({ action: 'client.update', tenantId, clientId, userId: updatedBy }, 'Cliente atualizado');
  void logAudit({
    tenantId,
    userId: updatedBy,
    action: 'client.update',
    entityType: 'clients',
    entityId: clientId,
    oldValue: existing,
    newValue: updated,
  });
  return updated;
}

export async function deleteClient(tenantId: number, clientId: number, deletedBy: number) {
  const existing = await getClient(tenantId, clientId);

  // Verificar OS vinculadas
  const [jobCount] = await db
    .select({ count: count() })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.clientId, clientId)));

  if ((jobCount?.count ?? 0) > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cliente possui OS vinculadas. Desative em vez de excluir.',
    });
  }

  await db.transaction(async (tx) => {
    await tx.update(clients)
      .set({ deletedAt: new Date(), deletedBy })
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)));

    await decrementCounter(tenantId, 'clients', tx);
  });

  logger.info({ action: 'client.delete', tenantId, clientId, userId: deletedBy }, 'Cliente removido (soft delete)');
  void logAudit({
    tenantId,
    userId: deletedBy,
    action: 'client.delete',
    entityType: 'clients',
    entityId: clientId,
    oldValue: existing,
    newValue: { deletedBy },
  });
}

export async function toggleClientStatus(tenantId: number, clientId: number) {
  const client = await getClient(tenantId, clientId);
  const newStatus = client.status === 'active' ? 'inactive' : 'active';

  const [updated] = await db.update(clients)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)))
    .returning();
  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente nÃ£o encontrado' });

  logger.info({ action: 'client.status_change', tenantId, clientId, newStatus }, 'Status do cliente alterado');
  return updated;
}

export async function getClientExtract(tenantId: number, clientId: number) {
  const client = await getClient(tenantId, clientId);

  // Buscar totais de jobs — pode retornar 0 se tabela não populada (Fase 6)
  let totalJobs = 0;
  let totalRevenueCents = 0;

  try {
    const [jobStats] = await db
      .select({ total: count(), revenue: sql<number>`COALESCE(SUM(total_cents), 0)` })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.clientId, clientId)));
    totalJobs = jobStats?.total ?? 0;
    totalRevenueCents = Number(jobStats?.revenue ?? 0);
  } catch {
    // Tabela pode não existir ainda — Fase 6
  }

  // accounts_receivable — implementada na Fase 8
  const pendingCents = 0;

  return { client, totalJobs, totalRevenueCents, pendingCents };
}

export async function lookupCep(cep: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('ViaCEP indisponível');

    const data = await res.json() as Record<string, unknown>;

    if (data.erro) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'CEP não encontrado' });
    }

    return {
      street: data.logradouro as string,
      neighborhood: data.bairro as string,
      city: data.localidade as string,
      state: data.uf as string,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Serviço de CEP indisponível. Preencha manualmente.' });
  }
}
