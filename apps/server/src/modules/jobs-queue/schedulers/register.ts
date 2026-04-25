import { logger } from '../../../logger.js';
import { getFlowQueues } from '../queue.js';

const SCHEDULES = {
  briefingDaily: '0 * * * *',
  deadline24h: '0 9 * * *',
  deadlineOverdue: '0 10 * * *',
  stockLow: '0 8,14 * * *',
  paymentOverdue: '0 11 * * *',
} as const;

let schedulesRegistered = false;

export async function registerFlowSchedulers(): Promise<void> {
  if (schedulesRegistered) return;

  const { briefingQueue, alertsQueue } = getFlowQueues();

  await briefingQueue.add(
    'briefing-scan',
    { kind: 'briefing_scan' },
    {
      jobId: 'flow-briefing-scan',
      repeat: { pattern: SCHEDULES.briefingDaily },
    },
  );

  await alertsQueue.add(
    'alerts-scan-deadline-24h',
    { kind: 'alert_scan', alertType: 'deadline_24h' },
    {
      jobId: 'flow-alerts-scan-deadline-24h',
      repeat: { pattern: SCHEDULES.deadline24h },
    },
  );

  await alertsQueue.add(
    'alerts-scan-deadline-overdue',
    { kind: 'alert_scan', alertType: 'deadline_overdue' },
    {
      jobId: 'flow-alerts-scan-deadline-overdue',
      repeat: { pattern: SCHEDULES.deadlineOverdue },
    },
  );

  await alertsQueue.add(
    'alerts-scan-stock-low',
    { kind: 'alert_scan', alertType: 'stock_low' },
    {
      jobId: 'flow-alerts-scan-stock-low',
      repeat: { pattern: SCHEDULES.stockLow },
    },
  );

  await alertsQueue.add(
    'alerts-scan-payment-overdue',
    { kind: 'alert_scan', alertType: 'payment_overdue' },
    {
      jobId: 'flow-alerts-scan-payment-overdue',
      repeat: { pattern: SCHEDULES.paymentOverdue },
    },
  );

  schedulesRegistered = true;
  logger.info({ action: 'jobs_queue.schedulers.registered' }, 'Schedulers do motor proativo registrados');
}
