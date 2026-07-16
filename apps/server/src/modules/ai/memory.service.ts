import { TRPCError } from '@trpc/server';
import { and, asc, count, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import type { Role } from '@proteticflow/shared';
import { PLAN_TIER } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { aiTenantSettings, tenants } from '../../db/schema/index.js';
import { aiMemory, type AiMemoryValue } from '../../db/schema/ai-memory.js';
import { logAudit } from '../audit/service.js';
import {
  observeAiMemoryRecallLatency,
  recordAiMemoryCapEviction,
  recordAiMemoryForget,
  recordAiMemoryRecallResult,
  setAiMemoryTotal,
} from '../../metrics/ai-metrics.js';
import { sanitizeUserText } from './security/sanitize.js';
import { embedText } from './embeddings.provider.js';

export const MAX_MEMORY_ENTRIES = 500;
export const MAX_MEMORY_KEYS = MAX_MEMORY_ENTRIES;
export const MAX_MEMORY_VALUE_BYTES = 2048;
export const DEFAULT_MEMORY_TTL_DAYS = 180;
export const MAX_MEMORY_TTL_DAYS = 365;

export const MEMORY_CATEGORIES = ['client_preference', 'workflow_rule', 'entity_alias', 'general'] as const;
export const MEMORY_SCOPES = ['user', 'tenant'] as const;
export const MEMORY_SOURCES = ['flow_ia', 'manual', 'inferred'] as const;

type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
type MemoryScope = (typeof MEMORY_SCOPES)[number];
type MemorySource = (typeof MEMORY_SOURCES)[number];

export type TenantCtx = {
  tenantId: number;
  userId: number;
  role?: Role;
};

export type RememberInput = {
  scope: MemoryScope;
  category: MemoryCategory;
  keyText: string;
  valueJson: Record<string, unknown>;
  entityType?: string | null | undefined;
  entityId?: number | null | undefined;
  source?: MemorySource | undefined;
  confidence?: number | undefined;
  ttlDays?: number | undefined;
};

export type RecallQuery = {
  text: string;
  category?: MemoryCategory | undefined;
  entityType?: string | undefined;
  entityId?: number | undefined;
  limit?: number | undefined;
};

export type ListMemoryFilters = {
  page?: number | undefined;
  limit?: number | undefined;
  category?: MemoryCategory | undefined;
  scope?: MemoryScope | undefined;
  entityType?: string | undefined;
  entityId?: number | undefined;
  search?: string | undefined;
};

export type UpdateMemoryInput = {
  keyText?: string | undefined;
  valueJson?: Record<string, unknown> | undefined;
  category?: MemoryCategory | undefined;
  entityType?: string | null | undefined;
  entityId?: number | null | undefined;
  confidence?: number | undefined;
  ttlDays?: number | undefined;
};

export type MemorySettings = {
  enabled: boolean;
  paused: boolean;
  plan: string;
  allowedByPlan: boolean;
};

export type MemoryModel = {
  id: string;
  tenantId: number;
  userId: number | null;
  scope: MemoryScope;
  category: MemoryCategory;
  entityType: string | null;
  entityId: number | null;
  keyText: string;
  valueJson: AiMemoryValue;
  source: MemorySource;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  expiresAt: string;
  similarity?: number;
};

type AiMemoryRow = typeof aiMemory.$inferSelect;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const PLAN_RANK: Record<string, number> = {
  [PLAN_TIER.TRIAL]: 0,
  [PLAN_TIER.STARTER]: 1,
  [PLAN_TIER.PRO]: 2,
  [PLAN_TIER.ENTERPRISE]: 3,
};

function clampConfidence(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function resolveTtlDays(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MEMORY_TTL_DAYS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TTL da memoria deve ser positivo' });
  }
  if (value > MAX_MEMORY_TTL_DAYS) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'TTL da memoria nao pode exceder 365 dias' });
  }
  return Math.trunc(value);
}

function expiresAtFromTtl(ttlDays: number): Date {
  return new Date(Date.now() + ttlDays * 86_400_000);
}

function normalizeCategory(value: string): MemoryCategory {
  if ((MEMORY_CATEGORIES as readonly string[]).includes(value)) return value as MemoryCategory;
  return 'general';
}

function normalizeScope(value: string): MemoryScope {
  return value === 'tenant' ? 'tenant' : 'user';
}

function normalizeSource(value: string): MemorySource {
  if ((MEMORY_SOURCES as readonly string[]).includes(value)) return value as MemorySource;
  return 'flow_ia';
}

function toMemoryModel(row: AiMemoryRow & { similarity?: number | null }): MemoryModel {
  const model: MemoryModel = {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    scope: normalizeScope(row.scope),
    category: normalizeCategory(row.category),
    entityType: row.entityType,
    entityId: row.entityId,
    keyText: row.keyText,
    valueJson: row.valueJson,
    source: normalizeSource(row.source),
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
    accessCount: row.accessCount,
    expiresAt: row.expiresAt.toISOString(),
  };

  if (typeof row.similarity === 'number') {
    model.similarity = row.similarity;
  }

  return model;
}

function sanitizeMemoryText(value: string): string {
  const result = sanitizeUserText(value);
  if (result.clean.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Texto de memoria vazio apos sanitizacao' });
  }
  return result.clean;
}

function sanitizeOptionalMemoryText(value: string): string | null {
  const result = sanitizeUserText(value);
  return result.clean.length > 0 ? result.clean : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function sanitizeJsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string') return sanitizeMemoryText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
  if (typeof value === 'object') {
    const output: Record<string, JsonValue> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const cleanKey = sanitizeMemoryText(key).slice(0, 80);
      if (cleanKey.length === 0) continue;
      output[cleanKey] = sanitizeJsonValue(nestedValue);
    }
    return output;
  }
  return null;
}

function sanitizeMemoryValue(value: Record<string, unknown>): AiMemoryValue {
  const sanitized = sanitizeJsonValue(value);
  const normalized = typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized)
    ? sanitized as Record<string, JsonValue>
    : { value: sanitized };
  const bytes = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (bytes > MAX_MEMORY_VALUE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Memoria excede limite de 2KB por entrada' });
  }
  return normalized;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => {
    if (!Number.isFinite(value)) return '0';
    return Number(value.toFixed(8)).toString();
  }).join(',')}]`;
}

async function ensureAiSettingsRow(tenantId: number): Promise<typeof aiTenantSettings.$inferSelect> {
  const [existing] = await db
    .select()
    .from(aiTenantSettings)
    .where(eq(aiTenantSettings.tenantId, tenantId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(aiTenantSettings).values({ tenantId }).returning();
  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao inicializar configuracoes de IA' });
  }
  return created;
}

async function getTenantPlan(tenantId: number): Promise<string> {
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }
  return tenant.plan;
}

function isPlanAllowed(plan: string): boolean {
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[PLAN_TIER.PRO] ?? 2);
}

async function getMemorySettingsInternal(tenantId: number): Promise<MemorySettings> {
  const [settings, plan] = await Promise.all([
    ensureAiSettingsRow(tenantId),
    getTenantPlan(tenantId),
  ]);
  return {
    enabled: settings.memoryEnabled,
    paused: settings.memoryInjectionPaused,
    plan,
    allowedByPlan: isPlanAllowed(plan),
  };
}

async function assertMemoryWriteAllowed(tenantId: number): Promise<void> {
  const settings = await getMemorySettingsInternal(tenantId);
  if (!settings.allowedByPlan) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Memoria persistente exige plano Pro ou Enterprise' });
  }
  if (!settings.enabled) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Memoria persistente requer opt-in explicito' });
  }
}

function buildAccessibleConditions(ctx: TenantCtx) {
  return [
    eq(aiMemory.tenantId, ctx.tenantId),
    gt(aiMemory.expiresAt, new Date()),
    or(eq(aiMemory.userId, ctx.userId), eq(aiMemory.scope, 'tenant')),
  ];
}

async function refreshTenantMemoryMetric(tenantId: number): Promise<void> {
  const rows = await db
    .select({
      scope: aiMemory.scope,
      category: aiMemory.category,
      total: count(),
    })
    .from(aiMemory)
    .where(eq(aiMemory.tenantId, tenantId))
    .groupBy(aiMemory.scope, aiMemory.category);

  for (const row of rows) {
    setAiMemoryTotal({
      tenantId,
      scope: row.scope,
      category: row.category,
      total: Number(row.total),
    });
  }
}

async function enforceTenantCapTx(tx: DbTransaction, tenantId: number): Promise<void> {
  const [row] = await tx
    .select({ total: count() })
    .from(aiMemory)
    .where(eq(aiMemory.tenantId, tenantId));
  const total = Number(row?.total ?? 0);
  if (total <= MAX_MEMORY_ENTRIES) return;

  const overflow = total - MAX_MEMORY_ENTRIES;
  const victims = await tx
    .select({ id: aiMemory.id })
    .from(aiMemory)
    .where(eq(aiMemory.tenantId, tenantId))
    .orderBy(asc(sql`COALESCE(${aiMemory.lastAccessedAt}, ${aiMemory.createdAt})`), asc(aiMemory.createdAt))
    .limit(overflow);

  if (victims.length === 0) return;

  await tx
    .delete(aiMemory)
    .where(and(
      eq(aiMemory.tenantId, tenantId),
      inArray(aiMemory.id, victims.map((victim) => victim.id)),
    ));

  recordAiMemoryCapEviction(tenantId, victims.length);
}

export class MemoryService {
  async getSettings(ctx: TenantCtx): Promise<MemorySettings> {
    return getMemorySettingsInternal(ctx.tenantId);
  }

  async updateSettings(
    ctx: TenantCtx,
    input: { enabled?: boolean | undefined; paused?: boolean | undefined },
  ): Promise<MemorySettings> {
    const current = await getMemorySettingsInternal(ctx.tenantId);
    if (input.enabled === true && !current.allowedByPlan) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Memoria persistente exige plano Pro ou Enterprise' });
    }

    await db
      .update(aiTenantSettings)
      .set({
        memoryEnabled: input.enabled ?? current.enabled,
        memoryInjectionPaused: input.paused ?? current.paused,
        updatedAt: new Date(),
      })
      .where(eq(aiTenantSettings.tenantId, ctx.tenantId));

    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'memory.settings.update',
      entityType: 'ai_memory',
      oldValue: current,
      newValue: input,
    });

    return getMemorySettingsInternal(ctx.tenantId);
  }

  async remember(ctx: TenantCtx, input: RememberInput): Promise<MemoryModel> {
    await assertMemoryWriteAllowed(ctx.tenantId);

    const keyText = sanitizeMemoryText(input.keyText);
    const valueJson = sanitizeMemoryValue(input.valueJson);
    const ttlDays = resolveTtlDays(input.ttlDays);
    const embedding = await embedText(keyText);
    const scope = input.scope;
    const userId = scope === 'user' ? ctx.userId : null;
    const now = new Date();

    const values: typeof aiMemory.$inferInsert = {
      tenantId: ctx.tenantId,
      userId,
      scope,
      category: input.category,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      keyText,
      valueJson,
      embedding,
      source: input.source ?? 'flow_ia',
      confidence: clampConfidence(input.confidence),
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAtFromTtl(ttlDays),
    };

    const row = await db.transaction(async (tx) => {
      const [upserted] = await tx
        .insert(aiMemory)
        .values(values)
        .onConflictDoUpdate({
          target: [
            aiMemory.tenantId,
            aiMemory.scope,
            aiMemory.category,
            aiMemory.keyText,
            aiMemory.userId,
            aiMemory.entityType,
            aiMemory.entityId,
          ],
          set: {
            valueJson,
            embedding,
            source: values.source,
            confidence: values.confidence,
            updatedAt: now,
            expiresAt: values.expiresAt,
          },
        })
        .returning();

      if (!upserted) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao gravar memoria' });
      }

      await enforceTenantCapTx(tx, ctx.tenantId);
      return upserted;
    });

    void refreshTenantMemoryMetric(ctx.tenantId);
    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'memory.remember',
      entityType: 'ai_memory',
      newValue: { memoryId: row.id, category: row.category, scope: row.scope },
    });

    return toMemoryModel(row);
  }

  async recall(ctx: TenantCtx, query: RecallQuery): Promise<MemoryModel[]> {
    const startedAt = Date.now();
    let settings: MemorySettings;
    try {
      settings = await getMemorySettingsInternal(ctx.tenantId);
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
        recordAiMemoryRecallResult(ctx.tenantId, false);
        return [];
      }
      throw error;
    }

    if (!settings.allowedByPlan || !settings.enabled || settings.paused) {
      recordAiMemoryRecallResult(ctx.tenantId, false);
      return [];
    }

    const text = sanitizeMemoryText(query.text);
    const limit = clampLimit(query.limit, 5, 20);
    const conditions = buildAccessibleConditions(ctx);
    if (query.category) conditions.push(eq(aiMemory.category, query.category));
    if (query.entityType) conditions.push(eq(aiMemory.entityType, query.entityType));
    if (query.entityId !== undefined) conditions.push(eq(aiMemory.entityId, query.entityId));

    const embedding = await embedText(text);
    const vectorLiteral = toVectorLiteral(embedding);
    const similarity = sql<number>`${aiMemory.embedding} <=> ${vectorLiteral}::vector`;

    const rows = await db
      .select({
        id: aiMemory.id,
        tenantId: aiMemory.tenantId,
        userId: aiMemory.userId,
        scope: aiMemory.scope,
        category: aiMemory.category,
        entityType: aiMemory.entityType,
        entityId: aiMemory.entityId,
        keyText: aiMemory.keyText,
        valueJson: aiMemory.valueJson,
        embedding: aiMemory.embedding,
        source: aiMemory.source,
        confidence: aiMemory.confidence,
        createdAt: aiMemory.createdAt,
        updatedAt: aiMemory.updatedAt,
        lastAccessedAt: aiMemory.lastAccessedAt,
        accessCount: aiMemory.accessCount,
        expiresAt: aiMemory.expiresAt,
        similarity,
      })
      .from(aiMemory)
      .where(and(...conditions, sql`${aiMemory.embedding} IS NOT NULL`))
      .orderBy(similarity)
      .limit(limit);

    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await db
        .update(aiMemory)
        .set({
          lastAccessedAt: new Date(),
          accessCount: sql`${aiMemory.accessCount} + 1`,
        })
        .where(and(eq(aiMemory.tenantId, ctx.tenantId), inArray(aiMemory.id, ids)));
    }

    observeAiMemoryRecallLatency(Date.now() - startedAt);
    recordAiMemoryRecallResult(ctx.tenantId, rows.length > 0);

    return rows.map(toMemoryModel);
  }

  async list(ctx: TenantCtx, filters: ListMemoryFilters): Promise<{
    items: MemoryModel[];
    total: number;
    page: number;
    limit: number;
    cap: number;
  }> {
    const page = clampLimit(filters.page, 1, 10_000);
    const limit = clampLimit(filters.limit, 20, 100);
    const conditions = buildAccessibleConditions(ctx);
    if (filters.category) conditions.push(eq(aiMemory.category, filters.category));
    if (filters.scope) conditions.push(eq(aiMemory.scope, filters.scope));
    if (filters.entityType) conditions.push(eq(aiMemory.entityType, filters.entityType));
    if (filters.entityId !== undefined) conditions.push(eq(aiMemory.entityId, filters.entityId));
    if (filters.search && filters.search.trim().length > 0) {
      const search = sanitizeOptionalMemoryText(filters.search);
      if (!search) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          cap: MAX_MEMORY_ENTRIES,
        };
      }
      const pattern = `%${escapeLikePattern(search)}%`;
      conditions.push(sql`${aiMemory.keyText} ILIKE ${pattern} ESCAPE '\\'`);
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(aiMemory)
        .where(where)
        .orderBy(desc(aiMemory.updatedAt), desc(aiMemory.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: count() })
        .from(aiMemory)
        .where(where),
    ]);

    return {
      items: rows.map(toMemoryModel),
      total: Number(totalRows[0]?.total ?? 0),
      page,
      limit,
      cap: MAX_MEMORY_ENTRIES,
    };
  }

  async update(ctx: TenantCtx, memoryId: string, input: UpdateMemoryInput): Promise<MemoryModel> {
    await assertMemoryWriteAllowed(ctx.tenantId);

    const [existing] = await db
      .select()
      .from(aiMemory)
      .where(and(
        eq(aiMemory.id, memoryId),
        eq(aiMemory.tenantId, ctx.tenantId),
        or(eq(aiMemory.userId, ctx.userId), eq(aiMemory.scope, 'tenant')),
      ))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Memoria nao encontrada' });
    }

    const keyText = input.keyText !== undefined ? sanitizeMemoryText(input.keyText) : existing.keyText;
    const patch: Partial<typeof aiMemory.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.keyText !== undefined) {
      patch.keyText = keyText;
      patch.embedding = await embedText(keyText);
    }
    if (input.valueJson !== undefined) patch.valueJson = sanitizeMemoryValue(input.valueJson);
    if (input.category !== undefined) patch.category = input.category;
    if (input.entityType !== undefined) patch.entityType = input.entityType;
    if (input.entityId !== undefined) patch.entityId = input.entityId;
    if (input.confidence !== undefined) patch.confidence = clampConfidence(input.confidence);
    if (input.ttlDays !== undefined) patch.expiresAt = expiresAtFromTtl(resolveTtlDays(input.ttlDays));

    const [updated] = await db
      .update(aiMemory)
      .set(patch)
      .where(and(eq(aiMemory.id, memoryId), eq(aiMemory.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar memoria' });
    }

    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'memory.edit',
      entityType: 'ai_memory',
      oldValue: { memoryId: existing.id, category: existing.category, scope: existing.scope },
      newValue: { memoryId: updated.id, category: updated.category, scope: updated.scope },
    });

    return toMemoryModel(updated);
  }

  async renew(ctx: TenantCtx, memoryId: string, ttlDays = DEFAULT_MEMORY_TTL_DAYS): Promise<MemoryModel> {
    return this.update(ctx, memoryId, { ttlDays });
  }

  async forget(ctx: TenantCtx, memoryId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(aiMemory)
      .where(and(
        eq(aiMemory.id, memoryId),
        eq(aiMemory.tenantId, ctx.tenantId),
        or(eq(aiMemory.userId, ctx.userId), eq(aiMemory.scope, 'tenant')),
      ))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Memoria nao encontrada' });
    }

    await db
      .delete(aiMemory)
      .where(and(eq(aiMemory.id, memoryId), eq(aiMemory.tenantId, ctx.tenantId)));

    recordAiMemoryForget(ctx.tenantId, 'user_explicit');
    void refreshTenantMemoryMetric(ctx.tenantId);
    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'memory.forget',
      entityType: 'ai_memory',
      oldValue: { memoryId, category: existing.category, scope: existing.scope },
    });
  }

  async forgetAll(ctx: TenantCtx): Promise<{ deleted: number }> {
    const rows = await db
      .delete(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, ctx.tenantId),
        or(eq(aiMemory.userId, ctx.userId), eq(aiMemory.scope, 'tenant')),
      ))
      .returning({ id: aiMemory.id });

    if (rows.length > 0) {
      recordAiMemoryForget(ctx.tenantId, 'user_explicit', rows.length);
      void refreshTenantMemoryMetric(ctx.tenantId);
      void logAudit({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'memory.forget_all',
        entityType: 'ai_memory',
        oldValue: { deleted: rows.length },
      });
    }

    return { deleted: rows.length };
  }

  async exportJson(ctx: TenantCtx): Promise<{ generatedAt: string; items: MemoryModel[] }> {
    const rows = await db
      .select()
      .from(aiMemory)
      .where(and(...buildAccessibleConditions(ctx)))
      .orderBy(desc(aiMemory.updatedAt), desc(aiMemory.createdAt));

    return {
      generatedAt: new Date().toISOString(),
      items: rows.map(toMemoryModel),
    };
  }

  async setQuietMode(ctx: TenantCtx, until: Date): Promise<MemoryModel> {
    if (!Number.isFinite(until.getTime()) || until <= new Date()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quiet mode exige data futura' });
    }

    const ttlDays = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 86_400_000));
    const keyText = 'quiet_mode_active';
    const valueJson = sanitizeMemoryValue({ until: until.toISOString(), bypass: ['urgent'] });
    const embedding = await embedText(keyText);
    const expiresAt = expiresAtFromTtl(Math.min(ttlDays, MAX_MEMORY_TTL_DAYS));
    const now = new Date();

    const values: typeof aiMemory.$inferInsert = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      scope: 'user',
      category: 'workflow_rule',
      entityType: null,
      entityId: null,
      keyText,
      valueJson,
      embedding,
      source: 'manual',
      confidence: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    const row = await db.transaction(async (tx) => {
      const [upserted] = await tx
        .insert(aiMemory)
        .values(values)
        .onConflictDoUpdate({
          target: [
            aiMemory.tenantId,
            aiMemory.scope,
            aiMemory.category,
            aiMemory.keyText,
            aiMemory.userId,
            aiMemory.entityType,
            aiMemory.entityId,
          ],
          set: {
            valueJson,
            embedding,
            source: 'manual',
            confidence: 1,
            updatedAt: now,
            expiresAt,
          },
        })
        .returning();

      if (!upserted) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao ativar quiet mode' });
      }

      await enforceTenantCapTx(tx, ctx.tenantId);
      return upserted;
    });

    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'memory.quiet_mode.set',
      entityType: 'ai_memory',
      newValue: { memoryId: row.id, expiresAt: row.expiresAt.toISOString() },
    });

    return toMemoryModel(row);
  }

  async getQuietModeReleaseAt(ctx: Pick<TenantCtx, 'tenantId' | 'userId'>): Promise<Date | null> {
    const [row] = await db
      .select({ expiresAt: aiMemory.expiresAt })
      .from(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, ctx.tenantId),
        eq(aiMemory.userId, ctx.userId),
        eq(aiMemory.scope, 'user'),
        eq(aiMemory.category, 'workflow_rule'),
        eq(aiMemory.keyText, 'quiet_mode_active'),
        gt(aiMemory.expiresAt, new Date()),
      ))
      .orderBy(desc(aiMemory.expiresAt))
      .limit(1);

    return row?.expiresAt ?? null;
  }
}

export const memoryService = new MemoryService();

export async function getMemory(
  tenantId: number,
  userId: number,
  now: Date = new Date(),
): Promise<Record<string, string>> {
  const rows = await db
    .select({ keyText: aiMemory.keyText, valueJson: aiMemory.valueJson })
    .from(aiMemory)
    .where(and(
      eq(aiMemory.tenantId, tenantId),
      eq(aiMemory.userId, userId),
      gt(aiMemory.expiresAt, now),
    ));

  return Object.fromEntries(rows.map((row) => [row.keyText, JSON.stringify(row.valueJson)]));
}

export async function setMemory(
  tenantId: number,
  userId: number,
  key: string,
  value: string,
  source: 'assistant' | 'user_explicit' = 'assistant',
  expiresAt?: Date,
): Promise<void> {
  const ttlDays = expiresAt
    ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
    : DEFAULT_MEMORY_TTL_DAYS;

  await memoryService.remember(
    { tenantId, userId },
    {
      scope: 'user',
      category: 'general',
      keyText: key,
      valueJson: { value },
      source: source === 'user_explicit' ? 'manual' : 'flow_ia',
      ttlDays: Math.min(ttlDays, MAX_MEMORY_TTL_DAYS),
    },
  );
}

export async function deleteMemoryKey(tenantId: number, userId: number, key: string): Promise<void> {
  const [row] = await db
    .select({ id: aiMemory.id })
    .from(aiMemory)
    .where(and(eq(aiMemory.tenantId, tenantId), eq(aiMemory.userId, userId), eq(aiMemory.keyText, key)))
    .limit(1);
  if (row) {
    await memoryService.forget({ tenantId, userId }, row.id);
  }
}

export async function clearAllMemory(tenantId: number, userId: number): Promise<void> {
  await memoryService.forgetAll({ tenantId, userId });
}

export async function countMemoryKeys(tenantId: number, userId: number): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(aiMemory)
    .where(and(eq(aiMemory.tenantId, tenantId), eq(aiMemory.userId, userId)));
  return Number(row?.total ?? 0);
}
