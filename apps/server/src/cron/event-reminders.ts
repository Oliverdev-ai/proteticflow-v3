import { db } from '../db/index.js';
import { notifications } from '../db/schema/notifications.js';
import { logger } from '../logger.js';
import { listPendingReminders, markReminderSent } from '../modules/agenda/service.js';

export async function eventReminders() {
  const now = new Date();
  const pending = await listPendingReminders(now);

  let sent = 0;
  for (const event of pending) {
    if (!event.createdBy) {
      await markReminderSent(event.tenantId, event.id);
      continue;
    }

    await db.insert(notifications).values({
      tenantId: event.tenantId,
      userId: event.createdBy,
      title: `Lembrete: ${event.title}`,
      message: `Evento agendado para ${event.startAt.toLocaleString('pt-BR')}`,
      type: 'info',
      relatedJobId: event.jobId ?? null,
    });

    await markReminderSent(event.tenantId, event.id);
    sent++;
    logger.info({
      action: 'agenda.reminder',
      tenantId: event.tenantId,
      eventId: event.id,
      userId: event.createdBy,
    }, 'Lembrete de agenda enviado');
  }

  logger.info({ action: 'cron.event_reminders.finish', pending: pending.length, sent }, 'Lembretes de agenda processados');
}

