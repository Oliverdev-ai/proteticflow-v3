import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { portalTokens } from '../../db/schema/portal.js';
import { logger } from '../../logger.js';

export async function portalTokenCleanup() {
  const now = new Date();

  const expired = await db
    .select({ id: portalTokens.id })
    .from(portalTokens)
    .where(and(
      isNull(portalTokens.revokedAt),
      lt(portalTokens.expiresAt, now),
    ));

  for (const token of expired) {
    await db
      .update(portalTokens)
      .set({ revokedAt: now })
      .where(eq(portalTokens.id, token.id));
  }

  logger.info(
    { action: 'portal.token.cleanup', affected: expired.length },
    'Cleanup diario de tokens expirados do portal concluido',
  );

  return { cleaned: expired.length };
}
