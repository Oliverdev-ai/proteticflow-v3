import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import type { Role } from '@proteticflow/shared';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { aiCommandRuns } from '../db/schema/ai.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
import { users } from '../db/schema/users.js';
import * as aiService from '../modules/ai/service.js';
import { confirmAndExecute, executeTool } from '../modules/ai/tool-executor.js';

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

describe('F38 O1 - tool executor', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. executa tool read_only sem confirmacao', async () => {
    const actor = await createActor('f38-read-only', 'gerente');
    const result = await executeTool(actor, 'jobs.listPending', {});
    expect(result.status).toBe('success');
  });

  it('2. tool transactional retorna awaiting_confirmation', async () => {
    const actor = await createActor('f38-transactional', 'gerente');
    const result = await executeTool(actor, 'jobs.toggleUrgent', { jobId: 77, isUrgent: true });
    expect(result.status).toBe('awaiting_confirmation');
  });

  it('3. tool critical retorna awaiting_confirmation', async () => {
    const actor = await createActor('f38-critical-awaiting', 'gerente');
    const result = await executeTool(actor, 'financial.monthlyClosing', { period: '2026-04' });
    expect(result.status).toBe('awaiting_confirmation');
  });

  it('4. confirmAndExecute executa apos confirmacao', async () => {
    const actor = await createActor('f38-confirm-execute', 'gerente');
    const result = await confirmAndExecute(actor, 'financial.monthlyClosing', { period: '2026-04' });
    expect(result.status).toBe('success');
  });

  it('5. input invalido gera erro de validacao zod', async () => {
    const actor = await createActor('f38-invalid-zod', 'gerente');
    await expect(executeTool(actor, 'jobs.getById', { jobId: 'abc' })).rejects.toThrow();
  });

  it('6. RBAC bloqueia comando sem permissao', async () => {
    const actor = await createActor('f38-rbac-block', 'producao');
    await expect(executeTool(actor, 'financial.monthlyClosing', { period: '2026-04' })).rejects.toThrow();
  });

  it('7. tool inexistente retorna erro', async () => {
    const actor = await createActor('f38-missing-tool', 'gerente');
    await expect(
      executeTool(actor, 'inexistente.comando' as never, {}),
    ).rejects.toThrow();
  });

  it('8. command_run e registrado com input e output', async () => {
    const actor = await createActor('f38-command-run', 'gerente');
    const response = await aiService.executeCommand(actor.tenantId, actor.userId, actor.role, {
      content: 'mostrar trabalhos pendentes',
      channel: 'text',
    });

    expect(response.run.id).toBeGreaterThan(0);
    expect(response.run.executionStatus).toBe('success');

    const history = await aiService.listCommandRuns(actor.tenantId, actor.userId, { limit: 10 });
    expect(history.data[0]?.id).toBe(response.run.id);
  });

  it('9. cancelCommand marca run como cancelled', async () => {
    const actor = await createActor('f38-cancel', 'gerente');
    const response = await aiService.executeCommand(actor.tenantId, actor.userId, actor.role, {
      content: 'suspender os 99 por aguardando retorno do dentista',
      channel: 'text',
    });

    expect(response.status).toBe('awaiting_confirmation');

    const cancelled = await aiService.cancelCommand(actor.tenantId, actor.userId, {
      commandRunId: response.run.id,
    });

    expect(cancelled.run.executionStatus).toBe('cancelled');
  });

  it('10. tenant isolation: nao confirma command_run de outro tenant', async () => {
    const actorA = await createActor('f38-tenant-a', 'gerente');
    const actorB = await createActor('f38-tenant-b', 'gerente');

    const runA = await aiService.executeCommand(actorA.tenantId, actorA.userId, actorA.role, {
      content: 'suspender os 42 por ajuste financeiro',
      channel: 'text',
    });

    expect(runA.status).toBe('awaiting_confirmation');

    await expect(aiService.confirmCommand(actorB.tenantId, actorB.userId, actorB.role, {
      commandRunId: runA.run.id,
    })).rejects.toThrow();
  });
});

