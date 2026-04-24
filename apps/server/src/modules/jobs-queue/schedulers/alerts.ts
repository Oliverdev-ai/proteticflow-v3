import type { Queue } from 'bullmq';
import { and, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import type { ProactiveAlertType } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { accountsReceivable } from '../../../db/schema/financials.js';
import { jobs } from '../../../db/schema/jobs.js';
import { materials } from '../../../db/schema/materials.js';
import { logger } from '../../../logger.js';
import { recordFlowAlertTriggered } from '../../../metrics/ai-metrics.js';
import { buildDedupKey, hasDedupInWindow } from '../../proactive/alert-log.service.js';
import {
  listActiveTenantRecipients,
  type ProactiveRecipient,
} from '../../proactive/recipient.service.js';
import type { FlowMessageJobData } from '../queue.js';

const ACTIVE_JOB_STATUSES: Array<typeof jobs.$inferSelect.status> = [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
];

const DEDUP_WINDOWS_MS: Record<Exclude<ProactiveAlertType, 'briefing_daily'>, number> = {
  deadline_24h: 24 * 60 * 60 * 1000,
  deadline_overdue: 48 * 60 * 60 * 1000,
  stock_low: 12 * 60 * 60 * 1000,
  payment_overdue: 72 * 60 * 60 * 1000,
};

type AlertSchedulerResult = {
  queued: number;
  skipped: number;
};

function windowSeed(now: Date, windowMs: number): string {
  return String(Math.floor(now.getTime() / windowMs));
}

function queueAlert(
  messagesQueue: Queue<FlowMessageJobData>,
  payload: FlowMessageJobData,
) {
  return messagesQueue.add(
    'send-message',
    payload,
    {
      jobId: `alert:${payload.alertType}:${payload.dedupKey}`,
    },
  );
}

async function getRecipientsForTenant(
  tenantId: number,
  cache: Map<number, Promise<ProactiveRecipient[]>>,
): Promise<ProactiveRecipient[]> {
  const cached = cache.get(tenantId);
  if (cached) return cached;
  const next = listActiveTenantRecipients(tenantId);
  cache.set(tenantId, next);
  return next;
}

export async function enqueueDeadline24hAlerts(
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<AlertSchedulerResult> {
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const rows = await db
    .select({
      tenantId: jobs.tenantId,
      jobId: jobs.id,
      code: jobs.code,
      deadline: jobs.deadline,
    })
    .from(jobs)
    .where(and(
      inArray(jobs.status, ACTIVE_JOB_STATUSES),
      gte(jobs.deadline, from),
      lte(jobs.deadline, to),
      isNull(jobs.deletedAt),
    ));

  const recipientsCache = new Map<number, Promise<ProactiveRecipient[]>>();
  let queued = 0;
  let skipped = 0;
  const windowMs = DEDUP_WINDOWS_MS.deadline_24h;
  const seed = windowSeed(now, windowMs);

  for (const row of rows) {
    const recipients = await getRecipientsForTenant(row.tenantId, recipientsCache);
    for (const recipient of recipients) {
      const dedupKey = buildDedupKey(
        `deadline_24h:${row.tenantId}:${recipient.userId}:${row.jobId}:${seed}`,
      );
      const dedupHit = await hasDedupInWindow(row.tenantId, dedupKey, windowMs, now);
      if (dedupHit) {
        recordFlowAlertTriggered(row.tenantId, 'deadline_24h', true);
        skipped += 1;
        continue;
      }

      await queueAlert(messagesQueue, {
        tenantId: row.tenantId,
        userId: recipient.userId,
        alertType: 'deadline_24h',
        priority: 'normal',
        title: `Prazo em 24h — ${row.code}`,
        body: `A OS ${row.code} vence nas proximas 24 horas.`,
        dedupKey,
        entityType: 'job',
        entityId: row.jobId,
      });
      recordFlowAlertTriggered(row.tenantId, 'deadline_24h', false);
      queued += 1;
    }
  }

  return { queued, skipped };
}

export async function enqueueDeadlineOverdueAlerts(
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<AlertSchedulerResult> {
  const rows = await db
    .select({
      tenantId: jobs.tenantId,
      jobId: jobs.id,
      code: jobs.code,
    })
    .from(jobs)
    .where(and(
      inArray(jobs.status, ACTIVE_JOB_STATUSES),
      lt(jobs.deadline, now),
      isNull(jobs.deletedAt),
    ));

  const recipientsCache = new Map<number, Promise<ProactiveRecipient[]>>();
  let queued = 0;
  let skipped = 0;
  const windowMs = DEDUP_WINDOWS_MS.deadline_overdue;
  const seed = windowSeed(now, windowMs);

  for (const row of rows) {
    const recipients = await getRecipientsForTenant(row.tenantId, recipientsCache);
    for (const recipient of recipients) {
      const dedupKey = buildDedupKey(
        `deadline_overdue:${row.tenantId}:${recipient.userId}:${row.jobId}:${seed}`,
      );
      const dedupHit = await hasDedupInWindow(row.tenantId, dedupKey, windowMs, now);
      if (dedupHit) {
        recordFlowAlertTriggered(row.tenantId, 'deadline_overdue', true);
        skipped += 1;
        continue;
      }

      await queueAlert(messagesQueue, {
        tenantId: row.tenantId,
        userId: recipient.userId,
        alertType: 'deadline_overdue',
        priority: 'normal',
        title: `OS atrasada — ${row.code}`,
        body: `A OS ${row.code} esta atrasada e precisa de atencao.`,
        dedupKey,
        entityType: 'job',
        entityId: row.jobId,
      });
      recordFlowAlertTriggered(row.tenantId, 'deadline_overdue', false);
      queued += 1;
    }
  }

  return { queued, skipped };
}

export async function enqueueStockLowAlerts(
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<AlertSchedulerResult> {
  const rows = await db
    .select({
      tenantId: materials.tenantId,
      materialId: materials.id,
      name: materials.name,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
    })
    .from(materials)
    .where(and(
      eq(materials.isActive, true),
      isNull(materials.deletedAt),
      sql`${materials.minStock} > 0`,
      sql`${materials.currentStock} <= ${materials.minStock}`,
    ));

  const recipientsCache = new Map<number, Promise<ProactiveRecipient[]>>();
  let queued = 0;
  let skipped = 0;
  const windowMs = DEDUP_WINDOWS_MS.stock_low;
  const seed = windowSeed(now, windowMs);

  for (const row of rows) {
    const recipients = await getRecipientsForTenant(row.tenantId, recipientsCache);
    const current = Number(row.currentStock);
    const min = Number(row.minStock);
    const isCritical = Number.isFinite(current) && Number.isFinite(min) && min > 0 && current <= min / 2;
    for (const recipient of recipients) {
      const dedupKey = buildDedupKey(
        `stock_low:${row.tenantId}:${recipient.userId}:${row.materialId}:${seed}`,
      );
      const dedupHit = await hasDedupInWindow(row.tenantId, dedupKey, windowMs, now);
      if (dedupHit) {
        recordFlowAlertTriggered(row.tenantId, 'stock_low', true);
        skipped += 1;
        continue;
      }

      await queueAlert(messagesQueue, {
        tenantId: row.tenantId,
        userId: recipient.userId,
        alertType: 'stock_low',
        priority: isCritical ? 'urgent' : 'normal',
        title: `Estoque baixo — ${row.name}`,
        body: `Material ${row.name} abaixo do minimo (${current} de ${min}).`,
        dedupKey,
        entityType: 'stock_item',
        entityId: row.materialId,
      });
      recordFlowAlertTriggered(row.tenantId, 'stock_low', false);
      queued += 1;
    }
  }

  return { queued, skipped };
}

export async function enqueuePaymentOverdueAlerts(
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<AlertSchedulerResult> {
  const threshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      tenantId: accountsReceivable.tenantId,
      arId: accountsReceivable.id,
      amountCents: accountsReceivable.amountCents,
    })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.status, 'pending'),
      lt(accountsReceivable.dueDate, threshold),
    ));

  const recipientsCache = new Map<number, Promise<ProactiveRecipient[]>>();
  let queued = 0;
  let skipped = 0;
  const windowMs = DEDUP_WINDOWS_MS.payment_overdue;
  const seed = windowSeed(now, windowMs);

  for (const row of rows) {
    const recipients = await getRecipientsForTenant(row.tenantId, recipientsCache);
    for (const recipient of recipients) {
      const dedupKey = buildDedupKey(
        `payment_overdue:${row.tenantId}:${recipient.userId}:${row.arId}:${seed}`,
      );
      const dedupHit = await hasDedupInWindow(row.tenantId, dedupKey, windowMs, now);
      if (dedupHit) {
        recordFlowAlertTriggered(row.tenantId, 'payment_overdue', true);
        skipped += 1;
        continue;
      }

      await queueAlert(messagesQueue, {
        tenantId: row.tenantId,
        userId: recipient.userId,
        alertType: 'payment_overdue',
        priority: 'normal',
        title: `Pagamento em atraso — AR #${row.arId}`,
        body: `Conta AR #${row.arId} esta vencida ha mais de 3 dias (valor ${row.amountCents / 100}).`,
        dedupKey,
        entityType: 'account_receivable',
        entityId: row.arId,
      });
      recordFlowAlertTriggered(row.tenantId, 'payment_overdue', false);
      queued += 1;
    }
  }

  return { queued, skipped };
}

export async function runAlertScheduler(
  alertType: Exclude<ProactiveAlertType, 'briefing_daily'>,
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<AlertSchedulerResult> {
  if (alertType === 'deadline_24h') {
    return enqueueDeadline24hAlerts(messagesQueue, now);
  }
  if (alertType === 'deadline_overdue') {
    return enqueueDeadlineOverdueAlerts(messagesQueue, now);
  }
  if (alertType === 'stock_low') {
    return enqueueStockLowAlerts(messagesQueue, now);
  }
  if (alertType === 'payment_overdue') {
    return enqueuePaymentOverdueAlerts(messagesQueue, now);
  }
  logger.warn({ action: 'jobs_queue.alerts.unsupported', alertType }, 'Tipo de alerta nao suportado');
  return { queued: 0, skipped: 0 };
}
