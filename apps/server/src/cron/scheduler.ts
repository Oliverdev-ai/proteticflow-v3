import cron from 'node-cron';
import { monthlyClosing } from './monthly-closing.js';
import { overdueReminders } from './overdue-reminders.js';
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

  logger.info('Cron jobs registrados');
}
