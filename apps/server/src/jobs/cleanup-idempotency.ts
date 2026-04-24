import { lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiCommandRuns } from '../db/schema/ai.js';
import { logger } from '../logger.js';
import { addAiIdempotencyCleanup } from '../metrics/ai-metrics.js';

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function cleanupIdempotencyKeys(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  const deletedRows = await db
    .delete(aiCommandRuns) // tenant-isolation-ok: limpeza global de retention para idempotency keys
    .where(lt(aiCommandRuns.createdAt, cutoff))
    .returning({ id: aiCommandRuns.id });

  const deleted = deletedRows.length;
  addAiIdempotencyCleanup(deleted);

  logger.info(
    {
      action: 'ai.idempotency.cleanup',
      cutoff: cutoff.toISOString(),
      deleted,
    },
    'Cleanup de idempotency keys executado',
  );

  return { deleted };
}
