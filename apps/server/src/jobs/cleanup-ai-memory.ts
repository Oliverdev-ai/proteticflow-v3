import { lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiMemory } from '../db/schema/ai-memory.js';
import { logger } from '../logger.js';
import { addAiMemoryCleanup, recordAiMemoryForget } from '../metrics/ai-metrics.js';

export async function cleanupAiMemory(): Promise<{ deleted: number }> {
  const now = new Date();
  const deletedRows = await db
    .delete(aiMemory) // tenant-isolation-ok: limpeza global por expiracao de memoria assistente
    .where(lt(aiMemory.expiresAt, now))
    .returning({ id: aiMemory.id, tenantId: aiMemory.tenantId });

  const deleted = deletedRows.length;
  addAiMemoryCleanup(deleted);
  const deletedByTenant = new Map<number, number>();
  for (const row of deletedRows) {
    deletedByTenant.set(row.tenantId, (deletedByTenant.get(row.tenantId) ?? 0) + 1);
  }
  for (const [tenantId, count] of deletedByTenant) {
    recordAiMemoryForget(tenantId, 'ttl_expired', count);
  }

  logger.info(
    {
      action: 'ai.memory.cleanup',
      deleted,
      now: now.toISOString(),
    },
    'Cleanup de memoria IA expiradas executado',
  );

  return { deleted };
}
