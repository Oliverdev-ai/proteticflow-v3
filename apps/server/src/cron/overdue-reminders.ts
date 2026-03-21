import { db } from '../db/index.js';
import { accountsReceivable } from '../db/schema/financials.js';
import { lt, eq, and } from 'drizzle-orm';
import { logger } from '../logger.js';

export async function overdueReminders() {
  const now = new Date();
  
  const arsToUpdate = await db.select({ id: accountsReceivable.id, tenantId: accountsReceivable.tenantId })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.status, 'pending'),
      lt(accountsReceivable.dueDate, now)
    ));

  let updatedCount = 0;

  for (const ar of arsToUpdate) {
    await db.update(accountsReceivable)
      .set({ status: 'overdue', updatedAt: new Date() })
      .where(eq(accountsReceivable.id, ar.id));
      
    // Stub de email
    logger.info({ action: 'cron.overdue_reminders.stub_email', arId: ar.id, tenantId: ar.tenantId }, 'Enviando lembrete de atraso (stub)');
    updatedCount++;
  }

  logger.info({ action: 'cron.overdue_reminders.finish', updatedCount }, 'Atualização de overdue concluída');
}
