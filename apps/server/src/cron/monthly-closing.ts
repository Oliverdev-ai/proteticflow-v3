import { db } from '../db/index.js';
import { tenants } from '../db/schema/tenants.js';
import { generateMonthlyClosing } from '../modules/financial/service.js';
import { logger } from '../logger.js';

export async function monthlyClosing() {
  const allTenants = await db.select({ id: tenants.id }).from(tenants);

  // Mês anterior
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  for (const t of allTenants) {
    try {
      // Passando 0 como userId (system)
      await generateMonthlyClosing(t.id, { period }, 0);
      logger.info({ tenantId: t.id, period }, 'Fechamento automático gerado com sucesso');
    } catch (error) {
      logger.error({ tenantId: t.id, period, err: error }, 'Erro ao gerar fechamento automático');
    }
  }
}
