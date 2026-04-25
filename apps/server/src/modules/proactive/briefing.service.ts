import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { events } from '../../db/schema/agenda.js';
import { accountsReceivable } from '../../db/schema/financials.js';
import { jobs } from '../../db/schema/jobs.js';
import { materials } from '../../db/schema/materials.js';
import { logger } from '../../logger.js';
import { addAiCostUsd, observeAiLatency, setAiCacheHitRate } from '../../metrics/ai-metrics.js';
import { ProviderResolver } from '../ai/providers/ProviderResolver.js';

const ACTIVE_JOB_STATUSES: Array<typeof jobs.$inferSelect.status> = [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
];

const providerResolver = new ProviderResolver();

type BriefingSummary = {
  overdueJobs: number;
  dueNext24h: number;
  dueNext48h: number;
  stockLowItems: number;
  todayAgendaItems: number;
  weekRevenueCents: number;
  previousWeekRevenueCents: number;
};

function startOfDay(baseDate: Date): Date {
  const next = new Date(baseDate);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(baseDate: Date): Date {
  const next = new Date(baseDate);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(baseDate: Date): Date {
  const day = baseDate.getDay();
  const distanceFromMonday = (day + 6) % 7;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - distanceFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function weekDeltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function buildFallbackBriefing(summary: BriefingSummary): string {
  const delta = weekDeltaPercent(summary.weekRevenueCents, summary.previousWeekRevenueCents);
  const deltaText = delta === null
    ? 'sem base comparativa da semana passada'
    : `${delta >= 0 ? '+' : ''}${delta}% vs semana passada`;

  return [
    'Bom dia.',
    `Você tem ${summary.overdueJobs} OS atrasadas e ${summary.dueNext24h} com vencimento nas próximas 24h.`,
    `${summary.dueNext48h} OS vencem nas próximas 48h.`,
    `Estoque em alerta: ${summary.stockLowItems} itens abaixo do mínimo.`,
    `Agenda de hoje: ${summary.todayAgendaItems} compromissos.`,
    `Faturamento da semana: ${toCurrency(summary.weekRevenueCents)} (${deltaText}).`,
  ].join(' ');
}

async function buildSummary(tenantId: number, userId: number, now: Date): Promise<BriefingSummary> {
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      inArray(jobs.status, ACTIVE_JOB_STATUSES),
      lte(jobs.deadline, now),
      isNull(jobs.deletedAt),
    ));

  const [due24hRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      inArray(jobs.status, ACTIVE_JOB_STATUSES),
      gte(jobs.deadline, now),
      lte(jobs.deadline, next24h),
      isNull(jobs.deletedAt),
    ));

  const [due48hRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      inArray(jobs.status, ACTIVE_JOB_STATUSES),
      gte(jobs.deadline, now),
      lte(jobs.deadline, next48h),
      isNull(jobs.deletedAt),
    ));

  const [stockLowRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(materials)
    .where(and(
      eq(materials.tenantId, tenantId),
      eq(materials.isActive, true),
      isNull(materials.deletedAt),
      sql`${materials.minStock} > 0`,
      sql`${materials.currentStock} <= ${materials.minStock}`,
    ));

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const [agendaRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(and(
      eq(events.tenantId, tenantId),
      eq(events.isCancelled, false),
      gte(events.startAt, todayStart),
      lte(events.startAt, todayEnd),
      sql`${events.employeeId} IS NULL OR ${events.employeeId} = ${userId}`,
    ));

  const weekStart = startOfWeek(now);
  const [weekRevenueRow] = await db
    .select({ sum: sql<number>`coalesce(sum(${accountsReceivable.amountCents}), 0)::int` })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      eq(accountsReceivable.status, 'paid'),
      gte(accountsReceivable.paidAt, weekStart),
      lte(accountsReceivable.paidAt, now),
    ));

  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(weekStart.getTime() - 1);

  const [previousWeekRevenueRow] = await db
    .select({ sum: sql<number>`coalesce(sum(${accountsReceivable.amountCents}), 0)::int` })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      eq(accountsReceivable.status, 'paid'),
      gte(accountsReceivable.paidAt, previousWeekStart),
      lte(accountsReceivable.paidAt, previousWeekEnd),
    ));

  return {
    overdueJobs: overdueRow?.count ?? 0,
    dueNext24h: due24hRow?.count ?? 0,
    dueNext48h: due48hRow?.count ?? 0,
    stockLowItems: stockLowRow?.count ?? 0,
    todayAgendaItems: agendaRow?.count ?? 0,
    weekRevenueCents: weekRevenueRow?.sum ?? 0,
    previousWeekRevenueCents: previousWeekRevenueRow?.sum ?? 0,
  };
}

async function formatWithLlm(
  tenantId: number,
  userId: number,
  summary: BriefingSummary,
): Promise<string | null> {
  const startedAt = Date.now();
  try {
    const result = await providerResolver.generate(
      {
        tenantId,
        userId,
        userRole: 'gerente',
        systemPrompt: [
          'Você é o assistente operacional do laboratório.',
          'Gere um briefing curto, objetivo e conversacional em português do Brasil.',
          'Não invente números.',
          'Máximo de 4 frases.',
        ].join(' '),
        history: [],
        message: `Converta os dados em briefing para início do dia: ${JSON.stringify(summary)}`,
      },
      [],
    );

    observeAiLatency({
      provider: result.providerUsed,
      source: 'proactive_briefing',
      latencyMs: Date.now() - startedAt,
    });
    setAiCacheHitRate(result.providerUsed, result.cached);
    addAiCostUsd({
      tenantId,
      provider: result.providerUsed,
      model: result.modelUsed,
      costCents: result.costCents,
    });

    const text = result.text.trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    logger.warn(
      { action: 'proactive.briefing.llm_fallback', tenantId, userId, err },
      'Falha no formatter LLM do briefing; aplicando fallback estático',
    );
    return null;
  }
}

export async function buildDailyBriefing(
  tenantId: number,
  userId: number,
  now: Date = new Date(),
): Promise<{ text: string; summary: BriefingSummary }> {
  const summary = await buildSummary(tenantId, userId, now);
  const llmText = await formatWithLlm(tenantId, userId, summary);
  return {
    text: llmText ?? buildFallbackBriefing(summary),
    summary,
  };
}
