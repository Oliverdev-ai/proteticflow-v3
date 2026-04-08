import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inArray, sql } from 'drizzle-orm';
import type { Role } from '@proteticflow/shared';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { aiCommandRuns } from '../db/schema/ai.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
import { users } from '../db/schema/users.js';
import * as aiService from '../modules/ai/service.js';
import { confirmAndExecute, executeTool } from '../modules/ai/tool-executor.js';
import * as financialService from '../modules/financial/service.js';
import * as payrollService from '../modules/payroll/service.js';
import * as purchaseService from '../modules/purchases/service.js';

type SeedRefs = {
  userIds: number[];
  tenantIds: number[];
};

const refs: SeedRefs = {
  userIds: [],
  tenantIds: [],
};

async function createActor(prefix: string, role: Role) {
  const [user] = await db
    .insert(users)
    .values({
      name: `User ${prefix}`,
      email: `${prefix}-${Date.now()}@test.com`,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();
  refs.userIds.push(user!.id);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Tenant ${prefix}`,
      slug: `tenant-${prefix}-${Date.now()}`,
    })
    .returning();
  refs.tenantIds.push(tenant!.id);

  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId: user!.id,
    role,
  });

  return {
    tenantId: tenant!.id,
    userId: user!.id,
    role,
  };
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  if (refs.tenantIds.length > 0) {
    await db.delete(aiCommandRuns).where(inArray(aiCommandRuns.tenantId, refs.tenantIds));
    await db.delete(tenantMembers).where(inArray(tenantMembers.tenantId, refs.tenantIds));
    await db.delete(tenants).where(inArray(tenants.id, refs.tenantIds));
  }
  if (refs.userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, refs.userIds));
  }
  refs.userIds = [];
  refs.tenantIds = [];
}

describe('F38 O3 - critical actions', () => {
  beforeEach(cleanup);
  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it('1. financial.closeAccount com multiplas contas retorna step de desambiguacao', async () => {
    const actor = await createActor('o3-financial-disambiguate', 'gerente');

    const mockList = {
      data: [
        {
          ar: { id: 101, amountCents: 120_000, dueDate: new Date('2026-04-20'), status: 'pending' },
          clientName: 'Dr. Ana',
        },
        {
          ar: { id: 102, amountCents: 98_000, dueDate: new Date('2026-04-25'), status: 'pending' },
          clientName: 'Dr. Ana',
        },
      ],
      nextCursor: undefined,
    } as unknown as Awaited<ReturnType<typeof financialService.listAr>>;

    vi.spyOn(financialService, 'listAr').mockResolvedValue(mockList);

    const result = await executeTool(actor, 'financial.closeAccount', { clientId: 77 });
    expect(result.status).toBe('awaiting_confirmation');
    if (result.status === 'awaiting_confirmation') {
      expect(result.step.type).toBe('disambiguate');
    }
  });

  it('2. financial.closeAccount com conta unica retorna confirm e confirma execucao', async () => {
    const actor = await createActor('o3-financial-confirm', 'gerente');

    vi.spyOn(financialService, 'getAr').mockResolvedValue({
      ar: {
        id: 110,
        amountCents: 150_000,
        dueDate: new Date('2026-04-30'),
        status: 'pending',
      },
      clientName: 'Dr. Bruno',
    } as unknown as Awaited<ReturnType<typeof financialService.getAr>>);

    vi.spyOn(financialService, 'markArPaid').mockResolvedValue({
      id: 110,
      status: 'paid',
    } as unknown as Awaited<ReturnType<typeof financialService.markArPaid>>);

    const preview = await executeTool(actor, 'financial.closeAccount', { id: 110 });
    expect(preview.status).toBe('awaiting_confirmation');
    if (preview.status === 'awaiting_confirmation') {
      expect(preview.step.type).toBe('confirm');
    }

    const confirmed = await confirmAndExecute(actor, 'financial.closeAccount', { id: 110 });
    expect(confirmed.status).toBe('success');
  });

  it('3. financial.monthlyClosing retorna preview critico com confirmacao', async () => {
    const actor = await createActor('o3-monthly-closing', 'contabil');

    vi.spyOn(financialService, 'getDashboardSummary').mockResolvedValue({
      totalReceivableCents: 280_000,
      totalPayableCents: 90_000,
      overdueCents: 20_000,
      monthFlowCents: 190_000,
    } as unknown as Awaited<ReturnType<typeof financialService.getDashboardSummary>>);

    vi.spyOn(financialService, 'listAr').mockResolvedValue({
      data: [],
      nextCursor: undefined,
    } as unknown as Awaited<ReturnType<typeof financialService.listAr>>);

    const result = await executeTool(actor, 'financial.monthlyClosing', { period: '2026-04' });
    expect(result.status).toBe('awaiting_confirmation');
    if (result.status === 'awaiting_confirmation') {
      expect(result.step.type).toBe('confirm');
    }
  });

  it('4. payroll.generate sem periodo retorna desambiguacao de periodos', async () => {
    const actor = await createActor('o3-payroll-disambiguate', 'contabil');

    vi.spyOn(payrollService, 'listPeriods').mockResolvedValue([
      { id: 401, year: 2026, month: 4, status: 'open', totalGrossCents: 220_000 },
      { id: 402, year: 2026, month: 5, status: 'open', totalGrossCents: 210_000 },
    ] as unknown as Awaited<ReturnType<typeof payrollService.listPeriods>>);

    const result = await executeTool(actor, 'payroll.generate', {});
    expect(result.status).toBe('awaiting_confirmation');
    if (result.status === 'awaiting_confirmation') {
      expect(result.step.type).toBe('disambiguate');
    }
  });

  it('5. purchases.receive retorna preview de impacto antes de confirmar', async () => {
    const actor = await createActor('o3-purchase-review', 'gerente');

    vi.spyOn(purchaseService, 'getPurchase').mockResolvedValue({
      po: { id: 501, code: 'CMP-00501', status: 'sent', totalCents: 87_000 },
      supplierName: 'Dental Supply',
      items: [{}, {}, {}],
    } as unknown as Awaited<ReturnType<typeof purchaseService.getPurchase>>);

    const result = await executeTool(actor, 'purchases.receive', { purchaseId: 501 });
    expect(result.status).toBe('awaiting_confirmation');
    if (result.status === 'awaiting_confirmation') {
      expect(result.step.type).toBe('confirm');
      expect(result.preview.title).toContain('CMP-00501');
    }
  });

  it('6. RBAC bloqueia producao em comando critico de folha', async () => {
    const actor = await createActor('o3-rbac', 'producao');
    await expect(executeTool(actor, 'payroll.generate', { periodId: 1 })).rejects.toThrow();
  });

  it('7. resolveCommandStep respeita isolamento de tenant', async () => {
    const actorA = await createActor('o3-tenant-a', 'gerente');
    const actorB = await createActor('o3-tenant-b', 'gerente');

    const runA = await aiService.executeCommand(actorA.tenantId, actorA.userId, actorA.role, {
      content: 'suspender os 88 por aguardando retorno',
      channel: 'text',
    });

    await expect(aiService.resolveCommandStep(actorB.tenantId, actorB.userId, actorB.role, {
      commandRunId: runA.run.id,
      values: {},
    })).rejects.toThrow();
  });

  it('8. cancelCommand marca comando pendente como cancelled', async () => {
    const actor = await createActor('o3-cancel', 'gerente');
    const run = await aiService.executeCommand(actor.tenantId, actor.userId, actor.role, {
      content: 'suspender os 99 por aguardando financeiro',
      channel: 'text',
    });
    const cancelled = await aiService.cancelCommand(actor.tenantId, actor.userId, {
      commandRunId: run.run.id,
    });
    expect(cancelled.run.executionStatus).toBe('cancelled');
  });
});

