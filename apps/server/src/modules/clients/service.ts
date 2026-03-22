import { eq, and, isNull, ilike, or, sql, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { clients, pricingTables } from '../../db/schema/clients.js';
import { tenants } from '../../db/schema/tenants.js';
import { jobs } from '../../db/schema/jobs.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
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
  const [client] = await db.transaction(async (tx) => {
    const [c] = await tx.insert(clients).values({
      tenantId,
      createdBy,
      name: input.name,
      clinic: input.clinic,
      email: input.email || undefined,
      phone: input.phone,
      phone2: input.phone2,
      documentType: input.documentType,
      document: input.document,
      contactPerson: input.contactPerson,
      street: input.street,
      addressNumber: input.addressNumber,
      complement: input.complement,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      technicalPreferences: input.technicalPreferences,
      priceAdjustmentPercent: input.priceAdjustmentPercent?.toString() ?? '0',
      pricingTableId: input.pricingTableId,
    }).returning();

    // Incrementar contador do tenant atomicamente
    await tx.update(tenants)
      .set({ clientCount: sql`${tenants.clientCount} + 1` })
      .where(eq(tenants.id, tenantId));

    return [c];
  });

  logger.info({ action: 'client.create', tenantId, clientId: client.id, userId: createdBy }, 'Cliente criado');
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
  await getClient(tenantId, clientId); // valida isolamento

  const [updated] = await db.update(clients)
    .set({
      ...input,
      priceAdjustmentPercent: input.priceAdjustmentPercent?.toString(),
      email: input.email || undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)))
    .returning();

  logger.info({ action: 'client.update', tenantId, clientId, userId: updatedBy }, 'Cliente atualizado');
  return updated;
}

export async function deleteClient(tenantId: number, clientId: number, deletedBy: number) {
  await getClient(tenantId, clientId);

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

    await tx.update(tenants)
      .set({ clientCount: sql`GREATEST(${tenants.clientCount} - 1, 0)` })
      .where(eq(tenants.id, tenantId));
  });

  logger.info({ action: 'client.delete', tenantId, clientId, userId: deletedBy }, 'Cliente removido (soft delete)');
}

export async function toggleClientStatus(tenantId: number, clientId: number) {
  const client = await getClient(tenantId, clientId);
  const newStatus = client.status === 'active' ? 'inactive' : 'active';

  const [updated] = await db.update(clients)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(clients.tenantId, tenantId), eq(clients.id, clientId)))
    .returning();

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
