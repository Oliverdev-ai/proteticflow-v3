import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { AiLabContext, Role } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { clients } from '../../db/schema/clients.js';
import { jobs } from '../../db/schema/jobs.js';
import { accountsReceivable } from '../../db/schema/financials.js';
import { deliverySchedules } from '../../db/schema/deliveries.js';
import { materials } from '../../db/schema/materials.js';

function toCurrencyFromCents(value: number): string {
  return `R$ ${(value / 100).toFixed(2)}`;
}

export async function buildLabContext(tenantId: number): Promise<AiLabContext> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    totalClientsResult,
    jobCountsResult,
    deliveriesResult,
    criticalStockResult,
    arResult,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), isNull(clients.deletedAt))),

    db
      .select({ status: jobs.status, count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
      .groupBy(jobs.status),

    db
      .select({ count: sql<number>`count(*)` })
      .from(deliverySchedules)
      .where(
        and(
          eq(deliverySchedules.tenantId, tenantId),
          gte(deliverySchedules.date, startOfDay),
          lte(deliverySchedules.date, endOfDay),
        ),
      ),

    db
      .select({ count: sql<number>`count(*)` })
      .from(materials)
      .where(
        and(
          eq(materials.tenantId, tenantId),
          isNull(materials.deletedAt),
          sql`${materials.currentStock} < ${materials.minStock}`,
        ),
      ),

    db
      .select({ status: accountsReceivable.status, total: sql<number>`sum(${accountsReceivable.amountCents})` })
      .from(accountsReceivable)
      .where(eq(accountsReceivable.tenantId, tenantId))
      .groupBy(accountsReceivable.status),
  ]);

  const jobsByStatus = Object.fromEntries(
    jobCountsResult.map((row) => [row.status, Number(row.count)]),
  );

  const overdueAr = Number(arResult.find((row) => row.status === 'overdue')?.total ?? 0);
  const pendingAr = Number(arResult.find((row) => row.status === 'pending')?.total ?? 0);

  return {
    totalClients: Number(totalClientsResult[0]?.count ?? 0),
    jobsByStatus,
    deliveriesToday: Number(deliveriesResult[0]?.count ?? 0),
    criticalStock: Number(criticalStockResult[0]?.count ?? 0),
    overdueAr,
    pendingAr,
  };
}

export function buildSystemPrompt(context: AiLabContext, userRole: Role): string {
  return `Voce e o Flow, assistente de IA do ProteticFlow para laboratorios de protese dentaria.

CONTEXTO ATUAL DO LAB:
- Clientes ativos: ${context.totalClients}
- Trabalhos por status: ${JSON.stringify(context.jobsByStatus)}
- Entregas hoje: ${context.deliveriesToday}
- Estoque critico: ${context.criticalStock}
- AR vencido: ${toCurrencyFromCents(context.overdueAr)}
- AR pendente: ${toCurrencyFromCents(context.pendingAr)}

ROLE DO USUARIO: ${userRole}
${userRole === 'producao' ? 'RESTRICAO: nao forneca informacoes financeiras para este usuario.' : ''}

Fale sempre em portugues, de forma objetiva.
Se detectar um comando operacional permitido para este role, responda de forma direta com a acao/resultado.`;
}
