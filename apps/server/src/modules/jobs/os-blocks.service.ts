import { eq, and, lte, gte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks } from '../../db/schema/os-blocks.js';
import { clients } from '../../db/schema/clients.js';
import { TRPCError } from '@trpc/server';
import type { CreateOsBlockInput } from '@proteticflow/shared';

export async function createOsBlock(tenantId: number, input: CreateOsBlockInput) {
  // Validar se range conflita com blocos existentes
  const conflicting = await db.select().from(osBlocks).where(
    and(
      eq(osBlocks.tenantId, tenantId),
      lte(osBlocks.startNumber, input.endNumber),
      gte(osBlocks.endNumber, input.startNumber)
    )
  );

  if (conflicting.length > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'O intervalo do bloco sobrepõe um bloco existente',
    });
  }

  const [block] = await db.insert(osBlocks).values({
    tenantId,
    ...input,
  }).returning();

  return block;
}

export async function listOsBlocks(tenantId: number, clientId?: number) {
  const conditions = [eq(osBlocks.tenantId, tenantId)];
  if (clientId) {
    conditions.push(eq(osBlocks.clientId, clientId));
  }

  return db.select().from(osBlocks).where(and(...conditions));
}

export async function deleteOsBlock(tenantId: number, blockId: number) {
  const [existing] = await db.select().from(osBlocks).where(
    and(eq(osBlocks.tenantId, tenantId), eq(osBlocks.id, blockId))
  );

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Bloco de OS não encontrado' });
  }

  await db.delete(osBlocks).where(eq(osBlocks.id, blockId));
}

export async function resolveClientByOsNumber(tenantId: number, osNumber: number) {
  const [block] = await db.select()
    .from(osBlocks)
    .innerJoin(clients, eq(osBlocks.clientId, clients.id))
    .where(
      and(
        eq(osBlocks.tenantId, tenantId),
        lte(osBlocks.startNumber, osNumber),
        gte(osBlocks.endNumber, osNumber)
      )
    );

  if (!block) return null;

  return {
    clientId: block.clients.id,
    clientName: block.clients.name,
  };
}
