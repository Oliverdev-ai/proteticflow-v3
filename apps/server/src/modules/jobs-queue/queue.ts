import { Queue, type JobsOptions } from 'bullmq';
import type { ProactiveAlertType } from '@proteticflow/shared';
import type { MessagePriority } from '../messaging/channel.js';
import { getRedisConnectionOptions } from '../../redis.js';

export const FLOW_QUEUE_NAMES = {
  briefing: 'flow-briefing',
  alerts: 'flow-alerts',
  messages: 'flow-messages',
} as const;

export type FlowBriefingJobData = {
  kind: 'briefing_scan';
};

export type FlowAlertsJobData = {
  kind: 'alert_scan';
  alertType: Exclude<ProactiveAlertType, 'briefing_daily'>;
};

export type FlowMessageJobData = {
  tenantId: number;
  userId: number;
  alertType: ProactiveAlertType;
  priority: MessagePriority;
  title: string;
  body: string;
  dedupKey: string;
  entityType?: string;
  entityId?: number | null;
  payload?: Record<string, unknown> | null;
};

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 2000,
  removeOnFail: 1000,
};

let briefingQueue: Queue<FlowBriefingJobData> | null = null;
let alertsQueue: Queue<FlowAlertsJobData> | null = null;
let messagesQueue: Queue<FlowMessageJobData> | null = null;

function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

export function getFlowBriefingQueue(): Queue<FlowBriefingJobData> {
  briefingQueue ??= createQueue<FlowBriefingJobData>(FLOW_QUEUE_NAMES.briefing);
  return briefingQueue;
}

export function getFlowAlertsQueue(): Queue<FlowAlertsJobData> {
  alertsQueue ??= createQueue<FlowAlertsJobData>(FLOW_QUEUE_NAMES.alerts);
  return alertsQueue;
}

export function getFlowMessagesQueue(): Queue<FlowMessageJobData> {
  messagesQueue ??= createQueue<FlowMessageJobData>(FLOW_QUEUE_NAMES.messages);
  return messagesQueue;
}

export function getFlowQueues() {
  return {
    briefingQueue: getFlowBriefingQueue(),
    alertsQueue: getFlowAlertsQueue(),
    messagesQueue: getFlowMessagesQueue(),
  };
}

export async function closeFlowQueues(): Promise<void> {
  const closeOps: Array<Promise<void>> = [];
  if (briefingQueue) closeOps.push(briefingQueue.close());
  if (alertsQueue) closeOps.push(alertsQueue.close());
  if (messagesQueue) closeOps.push(messagesQueue.close());
  await Promise.all(closeOps);
  briefingQueue = null;
  alertsQueue = null;
  messagesQueue = null;
}
