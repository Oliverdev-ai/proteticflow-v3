export const PLAN_TIER = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER];
