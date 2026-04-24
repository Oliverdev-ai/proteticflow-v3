import { Worker, type Job } from 'bullmq';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import {
  observeFlowChannelLatency,
  observeFlowQueueJobDuration,
  recordFlowBriefingSent,
  recordFlowChannelSend,
  recordFlowQueueStalled,
  setFlowQueueDepth,
} from '../../metrics/ai-metrics.js';
import { getRedisConnectionOptions } from '../../redis.js';
import {
  createChannelRouter,
  NoAvailableChannelError,
  QuietHoursDeferredError,
} from '../messaging/channel.js';
import {
  claimAlertDispatch,
  finalizeAlertDispatch,
  releaseAlertClaim,
} from '../proactive/alert-log.service.js';
import { getRecipient } from '../proactive/recipient.service.js';
import { enqueueDailyBriefings } from './schedulers/briefing-daily.js';
import { runAlertScheduler } from './schedulers/alerts.js';
import { registerFlowSchedulers } from './schedulers/register.js';
import {
  closeFlowQueues,
  FLOW_QUEUE_NAMES,
  getFlowQueues,
  type FlowAlertsJobData,
  type FlowBriefingJobData,
  type FlowMessageJobData,
} from './queue.js';

const WORKER_POOL_SIZE = 4;

let workers: Worker[] = [];
let depthInterval: NodeJS.Timeout | null = null;
let started = false;

const channelRouter = createChannelRouter();

async function syncQueueDepthMetrics(): Promise<void> {
  const { briefingQueue, alertsQueue, messagesQueue } = getFlowQueues();

  const [briefingDepth, alertsDepth, messagesDepth] = await Promise.all([
    briefingQueue.getJobCounts('active', 'waiting', 'delayed'),
    alertsQueue.getJobCounts('active', 'waiting', 'delayed'),
    messagesQueue.getJobCounts('active', 'waiting', 'delayed'),
  ]);

  setFlowQueueDepth(FLOW_QUEUE_NAMES.briefing, (
    (briefingDepth.active ?? 0) + (briefingDepth.waiting ?? 0) + (briefingDepth.delayed ?? 0)
  ));
  setFlowQueueDepth(FLOW_QUEUE_NAMES.alerts, (
    (alertsDepth.active ?? 0) + (alertsDepth.waiting ?? 0) + (alertsDepth.delayed ?? 0)
  ));
  setFlowQueueDepth(FLOW_QUEUE_NAMES.messages, (
    (messagesDepth.active ?? 0) + (messagesDepth.waiting ?? 0) + (messagesDepth.delayed ?? 0)
  ));
}

function bindWorkerMetrics(queue: string, worker: Worker): void {
  worker.on('completed', (job) => {
    const durationMs = job.finishedOn && job.processedOn
      ? Math.max(0, job.finishedOn - job.processedOn)
      : 0;
    observeFlowQueueJobDuration(queue, job.name, durationMs);
  });
  worker.on('stalled', () => {
    recordFlowQueueStalled(queue);
  });
}

async function processBriefingJob(job: Job<FlowBriefingJobData>): Promise<void> {
  if (job.data.kind !== 'briefing_scan') return;
  const { messagesQueue } = getFlowQueues();
  await enqueueDailyBriefings(messagesQueue);
}

async function processAlertsJob(job: Job<FlowAlertsJobData>): Promise<void> {
  if (job.data.kind !== 'alert_scan') return;
  const { messagesQueue } = getFlowQueues();
  await runAlertScheduler(job.data.alertType, messagesQueue);
}

async function requeueForQuietHours(
  data: FlowMessageJobData,
  releaseAt: Date,
): Promise<void> {
  const { messagesQueue } = getFlowQueues();
  const delayMs = Math.max(1000, releaseAt.getTime() - Date.now());
  await messagesQueue.add(
    'send-message',
    data,
    {
      delay: delayMs,
      jobId: `quiet:${data.dedupKey}:${releaseAt.getTime()}`,
    },
  );
}

async function processMessageJob(job: Job<FlowMessageJobData>): Promise<void> {
  const data = job.data;
  const recipient = await getRecipient(data.tenantId, data.userId);
  if (!recipient) {
    logger.warn(
      { action: 'jobs_queue.message.skip_recipient_not_found', data },
      'Destinatario proativo nao encontrado',
    );
    if (data.alertType === 'briefing_daily') {
      recordFlowBriefingSent(data.tenantId, 'skipped');
    }
    return;
  }

  const claimId = await claimAlertDispatch({
    tenantId: data.tenantId,
    userId: data.userId,
    alertType: data.alertType,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    dedupKey: data.dedupKey,
    payload: data.payload ?? null,
  });

  if (!claimId) {
    if (data.alertType === 'briefing_daily') {
      recordFlowBriefingSent(data.tenantId, 'skipped');
    }
    return;
  }

  const startedAt = Date.now();
  try {
    const outboundMessage = {
      title: data.title,
      body: data.body,
      alertType: data.alertType,
      priority: data.priority,
      ...(data.entityType !== undefined ? { entityType: data.entityType } : {}),
      ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
      ...(data.payload !== undefined ? { payload: data.payload } : {}),
    };

    const results = await channelRouter.send(
      {
        tenantId: recipient.tenantId,
        plan: recipient.plan,
      },
      recipient,
      outboundMessage,
      data.priority,
    );

    const first = results[0];
    if (!first) {
      throw new NoAvailableChannelError();
    }

    await finalizeAlertDispatch(
      data.tenantId,
      claimId,
      first.channel,
      data.payload ?? null,
    );
    recordFlowChannelSend(first.channel, 'sent');
    observeFlowChannelLatency(first.channel, Date.now() - startedAt);

    if (data.alertType === 'briefing_daily') {
      recordFlowBriefingSent(data.tenantId, 'sent');
    }
  } catch (err) {
    await releaseAlertClaim(data.tenantId, claimId);

    if (err instanceof QuietHoursDeferredError) {
      await requeueForQuietHours(data, err.releaseAt);
      if (data.alertType === 'briefing_daily') {
        recordFlowBriefingSent(data.tenantId, 'skipped');
      }
      return;
    }

    if (err instanceof NoAvailableChannelError) {
      if (data.alertType === 'briefing_daily') {
        recordFlowBriefingSent(data.tenantId, 'skipped');
      }
      recordFlowChannelSend('in_app', 'failed');
      return;
    }

    recordFlowChannelSend('in_app', 'failed');
    throw err;
  }
}

export async function startFlowQueueWorkers(): Promise<void> {
  if (started) return;

  if (env.NODE_ENV === 'production' && env.WHATSAPP_PROVIDER === 'mock') {
    logger.error(
      { action: 'jobs_queue.bootstrap.invalid_whatsapp_provider' },
      'WHATSAPP_PROVIDER=mock em producao; servico proativo nao inicializado',
    );
    throw new Error('WHATSAPP_PROVIDER=mock nao permitido em producao');
  }

  await registerFlowSchedulers();
  const connection = getRedisConnectionOptions();

  for (let idx = 0; idx < WORKER_POOL_SIZE; idx += 1) {
    const briefingWorker = new Worker<FlowBriefingJobData>(
      FLOW_QUEUE_NAMES.briefing,
      processBriefingJob,
      {
        connection,
        concurrency: env.BULLMQ_CONCURRENCY,
        stalledInterval: env.BULLMQ_STALLED_INTERVAL,
      },
    );

    const alertsWorker = new Worker<FlowAlertsJobData>(
      FLOW_QUEUE_NAMES.alerts,
      processAlertsJob,
      {
        connection,
        concurrency: env.BULLMQ_CONCURRENCY,
        stalledInterval: env.BULLMQ_STALLED_INTERVAL,
      },
    );

    const messagesWorker = new Worker<FlowMessageJobData>(
      FLOW_QUEUE_NAMES.messages,
      processMessageJob,
      {
        connection,
        concurrency: env.BULLMQ_CONCURRENCY,
        stalledInterval: env.BULLMQ_STALLED_INTERVAL,
      },
    );

    bindWorkerMetrics(FLOW_QUEUE_NAMES.briefing, briefingWorker);
    bindWorkerMetrics(FLOW_QUEUE_NAMES.alerts, alertsWorker);
    bindWorkerMetrics(FLOW_QUEUE_NAMES.messages, messagesWorker);

    workers.push(briefingWorker, alertsWorker, messagesWorker);
  }

  depthInterval = setInterval(() => {
    void syncQueueDepthMetrics().catch((err) => {
      logger.warn({ err, action: 'jobs_queue.metrics.depth_sync_error' }, 'Falha ao sincronizar queue depth');
    });
  }, 15_000);

  await syncQueueDepthMetrics();
  started = true;
  logger.info(
    {
      action: 'jobs_queue.workers.started',
      workers: workers.length,
      poolSize: WORKER_POOL_SIZE,
      concurrency: env.BULLMQ_CONCURRENCY,
    },
    'Motor proativo inicializado',
  );
}

export async function stopFlowQueueWorkers(): Promise<void> {
  if (!started) return;
  if (depthInterval) {
    clearInterval(depthInterval);
    depthInterval = null;
  }
  await Promise.all(workers.map((worker) => worker.close()));
  workers = [];
  await closeFlowQueues();
  started = false;
}
