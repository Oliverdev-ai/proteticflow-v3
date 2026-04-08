import { db } from '../db/index.js';
import { tenants } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../logger.js';
import * as aiService from '../modules/ai/service.js';

async function listActiveTenantIds() {
  const rows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.isActive, true));
  return rows.map((row) => row.id);
}

export async function revenueForecastRefresh() {
  const tenantIds = await listActiveTenantIds();
  for (const tenantId of tenantIds) {
    try {
      await aiService.runRevenueForecastRefresh(tenantId, 'cron_revenue_forecast_refresh');
    } catch (error) {
      logger.error(
        { action: 'ai.cron.revenue_forecast_refresh.error', tenantId, err: error },
        'Falha na atualizacao de previsoes de receita',
      );
    }
  }
}

export async function stockDepletionForecast() {
  const tenantIds = await listActiveTenantIds();
  for (const tenantId of tenantIds) {
    try {
      await aiService.runStockDepletionForecast(tenantId, 'cron_stock_depletion_forecast');
    } catch (error) {
      logger.error(
        { action: 'ai.cron.stock_depletion_forecast.error', tenantId, err: error },
        'Falha na atualizacao de alerta de estoque',
      );
    }
  }
}

export async function reworkPatternDetection() {
  const tenantIds = await listActiveTenantIds();
  for (const tenantId of tenantIds) {
    try {
      await aiService.runReworkPatternDetection(tenantId, 'cron_rework_pattern_detection');
    } catch (error) {
      logger.error(
        { action: 'ai.cron.rework_pattern_detection.error', tenantId, err: error },
        'Falha na deteccao de padrao de retrabalho',
      );
    }
  }
}

export async function scheduleOptimizationRefresh() {
  const tenantIds = await listActiveTenantIds();
  for (const tenantId of tenantIds) {
    try {
      await aiService.runScheduleOptimizationRefresh(tenantId, 'cron_schedule_optimization_refresh');
    } catch (error) {
      logger.error(
        { action: 'ai.cron.schedule_optimization_refresh.error', tenantId, err: error },
        'Falha na atualizacao de otimizacao de agenda',
      );
    }
  }
}

export async function clientCreditScoreRefresh() {
  const tenantIds = await listActiveTenantIds();
  for (const tenantId of tenantIds) {
    try {
      await aiService.runClientCreditScoreRefresh(tenantId, 'cron_client_credit_score_refresh');
    } catch (error) {
      logger.error(
        { action: 'ai.cron.client_credit_score_refresh.error', tenantId, err: error },
        'Falha na atualizacao de score de credito',
      );
    }
  }
}
