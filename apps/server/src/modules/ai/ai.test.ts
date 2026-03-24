import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { hashPassword } from '../../core/auth.js';
import {
  aiFeedback,
  aiModelRuns,
  aiPredictions,
  aiRecommendations,
  aiTenantSettings,
  clients,
  jobs,
  tenants,
  tenantMembers,
  users,
} from '../../db/schema/index.js';
import * as aiService from './service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'AI Test',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();
  return u;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createClientAndJob(tenantId: number, userId: number, tag: string) {
  const { createClient } = await import('../clients/service.js');
  const client = await createClient(tenantId, { name: `Cliente ${tag}`, priceAdjustmentPercent: 0 }, userId);
  const { createJob, changeStatus } = await import('../jobs/service.js');

  const job = await createJob(tenantId, {
    clientId: client.id,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    items: [{
      serviceNameSnapshot: 'Prova IA',
      quantity: 1,
      unitPriceCents: 15000,
      adjustmentPercent: 0,
    }],
  }, userId);

  await changeStatus(tenantId, { jobId: job.id, newStatus: 'in_progress' }, userId);
  return { client, job };
}

async function cleanup() {
  await db.delete(aiFeedback);
  await db.delete(aiRecommendations);
  await db.delete(aiPredictions);
  await db.delete(aiModelRuns);
  await db.delete(aiTenantSettings);
  await db.delete(jobs);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('AI module foundation', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('gera sinais de IA e persistencia basica por tenant', async () => {
    const user = await createTestUser('ai-foundation@test.com');
    const tenant = await createTestTenant(user.id, 'Lab AI Foundation');
    await createClientAndJob(tenant.id, user.id, 'A');

    const result = await aiService.runDailyRefresh(tenant.id, 'test');
    expect(result.modelRuns).toBeGreaterThan(0);

    const predictions = await aiService.listPredictions(tenant.id, { limit: 50 });
    const recommendations = await aiService.listRecommendations(tenant.id, { limit: 50 });

    expect(predictions.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('respeita isolamento por tenant nas consultas', async () => {
    const u1 = await createTestUser('ai-t1@test.com');
    const u2 = await createTestUser('ai-t2@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab AI 1');
    const t2 = await createTestTenant(u2.id, 'Lab AI 2');
    await createClientAndJob(t1.id, u1.id, 'T1');
    await createClientAndJob(t2.id, u2.id, 'T2');

    await aiService.runDailyRefresh(t1.id, 'test');
    await aiService.runDailyRefresh(t2.id, 'test');

    const t1Predictions = await aiService.listPredictions(t1.id, { limit: 100 });
    const foreignInT1 = t1Predictions.find((row) => row.prediction.tenantId !== t1.id);

    expect(foreignInT1).toBeUndefined();
  });

  it('grava feedback e atualiza status da recomendacao', async () => {
    const user = await createTestUser('ai-feedback@test.com');
    const tenant = await createTestTenant(user.id, 'Lab AI Feedback');
    await createClientAndJob(tenant.id, user.id, 'FB');

    await aiService.runDailyRefresh(tenant.id, 'test');
    const recommendations = await aiService.listRecommendations(tenant.id, { limit: 20 });
    const target = recommendations[0]?.recommendation;

    expect(target).toBeDefined();
    if (!target) return;

    await aiService.recordFeedback(tenant.id, user.id, {
      recommendationId: target.id,
      decision: 'accepted',
      confidenceDelta: 0.1,
    });

    const [updated] = await db.select().from(aiRecommendations)
      .where(and(eq(aiRecommendations.id, target.id), eq(aiRecommendations.tenantId, tenant.id)));

    expect(updated?.status).toBe('accepted');
  });
});
