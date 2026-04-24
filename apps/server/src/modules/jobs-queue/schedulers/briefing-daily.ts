import type { Queue } from 'bullmq';
import { logger } from '../../../logger.js';
import { recordFlowAlertTriggered } from '../../../metrics/ai-metrics.js';
import { buildDailyBriefing } from '../../proactive/briefing.service.js';
import { buildDedupKey, hasDedupInWindow } from '../../proactive/alert-log.service.js';
import { listBriefingRecipients } from '../../proactive/recipient.service.js';
import type { FlowMessageJobData } from '../queue.js';

const BRIEFING_WINDOW_MS = 24 * 60 * 60 * 1000;

function dailyWindowSeed(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function enqueueDailyBriefings(
  messagesQueue: Queue<FlowMessageJobData>,
  now: Date = new Date(),
): Promise<{ queued: number; skipped: number }> {
  const recipients = await listBriefingRecipients(now);
  let queued = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const dedupKey = buildDedupKey(
      `briefing_daily:${recipient.tenantId}:${recipient.userId}:${dailyWindowSeed(now)}`,
    );

    const dedupHit = await hasDedupInWindow(recipient.tenantId, dedupKey, BRIEFING_WINDOW_MS, now);
    if (dedupHit) {
      recordFlowAlertTriggered(recipient.tenantId, 'briefing_daily', true);
      skipped += 1;
      continue;
    }

    const briefing = await buildDailyBriefing(recipient.tenantId, recipient.userId, now);
    await messagesQueue.add(
      'send-message',
      {
        tenantId: recipient.tenantId,
        userId: recipient.userId,
        alertType: 'briefing_daily',
        priority: 'normal',
        title: 'Bom dia — briefing do Flow IA',
        body: briefing.text,
        dedupKey,
        payload: {
          summary: briefing.summary,
        },
      },
      {
        jobId: `briefing:${dedupKey}`,
      },
    );
    recordFlowAlertTriggered(recipient.tenantId, 'briefing_daily', false);
    queued += 1;
  }

  logger.info(
    { action: 'jobs_queue.briefing.scan', queued, skipped, recipients: recipients.length },
    'Briefing diario processado',
  );
  return { queued, skipped };
}
