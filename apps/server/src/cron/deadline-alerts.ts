import { and, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jobs } from '../db/schema/jobs.js';
import { deadlineNotifLog } from '../db/schema/users.js';
import { dispatchByPreference } from '../modules/notifications/service.js';
import { logger } from '../logger.js';

const TRACKED_STATUSES: Array<typeof jobs.$inferSelect.status> = [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
];

export async function deadlineAlerts() {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingJobs = await db
    .select({
      id: jobs.id,
      tenantId: jobs.tenantId,
      code: jobs.code,
      deadline: jobs.deadline,
      assignedTo: jobs.assignedTo,
      createdBy: jobs.createdBy,
      status: jobs.status,
    })
    .from(jobs)
    .where(and(
      inArray(jobs.status, TRACKED_STATUSES),
      gte(jobs.deadline, now),
      lte(jobs.deadline, next24h),
    ));

  let sent = 0;

  for (const job of upcomingJobs) {
    const recipientUserId = job.assignedTo ?? job.createdBy;
    if (!recipientUserId) continue;

    const inserted = await db
      .insert(deadlineNotifLog)
      .values({
        tenantId: job.tenantId,
        userId: recipientUserId,
        jobId: job.id,
      })
      .onConflictDoNothing({
        target: [deadlineNotifLog.tenantId, deadlineNotifLog.userId, deadlineNotifLog.jobId],
      })
      .returning({ id: deadlineNotifLog.id });

    if (inserted.length === 0) continue;

    await dispatchByPreference({
      tenantId: job.tenantId,
      userId: recipientUserId,
      eventKey: 'deadline_24h',
      type: 'warning',
      title: 'Prazo em 24h',
      message: `A OS ${job.code} vence em ate 24h.`,
      relatedJobId: job.id,
      emailSubject: `Prazo da OS ${job.code}`,
      emailText: `A OS ${job.code} tem prazo ate ${job.deadline.toISOString()}.`,
    });

    sent++;
  }

  logger.info(
    { action: 'cron.deadline_alerts.finish', total: upcomingJobs.length, sent },
    'Alertas de prazo 24h processados',
  );
}
