import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  createCheckoutSessionSchema,
  superadminUpdateTenantPlanSchema,
} from '@proteticflow/shared';
import * as licensingService from './service.js';

describe('licensing contracts', () => {
  it('valida payload de checkout session', () => {
    const payload = createCheckoutSessionSchema.parse({
      planTier: 'pro',
      successUrl: 'https://app.proteticflow.com/planos?ok=1',
      cancelUrl: 'https://app.proteticflow.com/planos?cancel=1',
    });

    expect(payload.planTier).toBe('pro');
  });

  it('valida payload de update de plano por superadmin', () => {
    const payload = superadminUpdateTenantPlanSchema.parse({
      tenantId: 10,
      plan: 'starter',
      planExpiresAt: null,
    });

    expect(payload.tenantId).toBe(10);
    expect(payload.plan).toBe('starter');
  });

  it('mantem limites oficiais por plano', () => {
    expect(PLAN_LIMITS.trial.fullAccessDays).toBe(14);
    expect(PLAN_LIMITS.trial.clients).toBe(10);
    expect(PLAN_LIMITS.trial.jobsPerMonth).toBe(10);
    expect(PLAN_LIMITS.starter.jobsPerMonth).toBe(100);
    expect(PLAN_LIMITS.pro.jobsPerMonth).toBe(300);
    expect(PLAN_LIMITS.enterprise.users).toBeNull();
  });

  it('expoe funcoes principais do service', () => {
    expect(typeof licensingService.checkLimit).toBe('function');
    expect(typeof licensingService.checkFeatureAccess).toBe('function');
    expect(typeof licensingService.getLicenseStatus).toBe('function');
    expect(typeof licensingService.getUsageForTenant).toBe('function');
    expect(typeof licensingService.handleStripeWebhook).toBe('function');
    expect(typeof licensingService.processExpiredTrials).toBe('function');
  });
});
