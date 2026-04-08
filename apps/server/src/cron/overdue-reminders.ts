import { db } from '../db/index.js';
import { accountsReceivable } from '../db/schema/financials.js';
import { users } from '../db/schema/users.js';
import { lt, eq, and } from 'drizzle-orm';
import { logger } from '../logger.js';
import { dispatchByPreference } from '../modules/notifications/service.js';

export async function overdueReminders() {
  const now = new Date();

  const transitioned = await db
    .update(accountsReceivable)
    .set({ status: 'overdue', updatedAt: now })
    .where(and(
      eq(accountsReceivable.status, 'pending'),
      lt(accountsReceivable.dueDate, now),
    ))
    .returning({ id: accountsReceivable.id, tenantId: accountsReceivable.tenantId });

  for (const ar of transitioned) {
    const tenantUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.activeTenantId, ar.tenantId), eq(users.isActive, true)));

    for (const user of tenantUsers) {
      await dispatchByPreference({
        tenantId: ar.tenantId,
        userId: user.id,
        eventKey: 'ar_overdue',
        type: 'warning',
        title: 'Conta em atraso',
        message: `A conta #${ar.id} foi marcada como vencida.`,
        emailSubject: `Conta vencida #${ar.id}`,
        emailText: `A conta a receber #${ar.id} foi marcada como vencida no financeiro.`,
      });
    }

    logger.info(
      { action: 'cron.overdue_reminders.notify', arId: ar.id, tenantId: ar.tenantId, users: tenantUsers.length },
      'Lembretes de atraso enviados por canal configurado',
    );
  }

  logger.info({ action: 'cron.overdue_reminders.finish', updatedCount: transitioned.length }, 'Atualizacao de overdue concluida');
}
