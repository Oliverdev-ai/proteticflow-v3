// Alinhado ao PRD seção 1.5: trial (30 dias com funcionalidades pro) → starter → pro → enterprise
export const PLAN_TIER = {
  TRIAL: 'trial',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER];
