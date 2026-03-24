import cron from 'node-cron';
import { monthlyClosing } from './monthly-closing.js';
import { overdueReminders } from './overdue-reminders.js';
import { eventReminders } from './event-reminders.js';
import {
  clientCreditScoreRefresh,
  reworkPatternDetection,
  revenueForecastRefresh,
  scheduleOptimizationRefresh,
  stockDepletionForecast,
} from './ai-refresh.js';
import { logger } from '../logger.js';

export function startCronJobs() {
  // 07.04: Fechamento automático — dia 1 de cada mês às 6h
  cron.schedule('0 6 1 * *', async () => {
    logger.info({ action: 'cron.monthly_closing.start' }, 'Iniciando fechamento mensal');
    await monthlyClosing();
  });

  // 07.05: Lembretes de vencimento — diário às 8h
  cron.schedule('0 8 * * *', async () => {
    logger.info({ action: 'cron.overdue_reminders.start' }, 'Verificando contas vencidas');
    await overdueReminders();
  });

  // 23.06: Lembretes de agenda - a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    logger.info({ action: 'cron.event_reminders.start' }, 'Processando lembretes de agenda');
    await eventReminders();
  });

  // 22.xx AI: previsao de receita - diario as 04h
  cron.schedule('0 4 * * *', async () => {
    logger.info({ action: 'cron.ai.revenue_forecast_refresh.start' }, 'Atualizando previsao de receita');
    await revenueForecastRefresh();
  });

  // 22.xx AI: alerta de estoque - diario as 05h
  cron.schedule('0 5 * * *', async () => {
    logger.info({ action: 'cron.ai.stock_depletion_forecast.start' }, 'Atualizando previsao de ruptura de estoque');
    await stockDepletionForecast();
  });

  // 22.xx AI: score de credito - diario as 06h30
  cron.schedule('30 6 * * *', async () => {
    logger.info({ action: 'cron.ai.client_credit_score_refresh.start' }, 'Atualizando score de credito');
    await clientCreditScoreRefresh();
  });

  // 22.xx AI: deteccao de retrabalho - nightly as 03h
  cron.schedule('0 3 * * *', async () => {
    logger.info({ action: 'cron.ai.rework_pattern_detection.start' }, 'Atualizando padroes de retrabalho');
    await reworkPatternDetection();
  });

  // 22.xx AI: refresh operacional - horario
  cron.schedule('0 * * * *', async () => {
    logger.info({ action: 'cron.ai.schedule_optimization_refresh.start' }, 'Atualizando recomendacoes operacionais');
    await scheduleOptimizationRefresh();
  });

  logger.info('Cron jobs registrados');
}
