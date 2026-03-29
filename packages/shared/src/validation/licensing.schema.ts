import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  planTier: z.enum(['starter', 'pro', 'enterprise']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const updatePlanSchema = z.object({
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']),
  planExpiresAt: z.string().datetime().nullable().optional(),
});

export const superadminUpdateTenantPlanSchema = z.object({
  tenantId: z.number().int().positive(),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']),
  planExpiresAt: z.string().datetime().nullable().optional(),
});
