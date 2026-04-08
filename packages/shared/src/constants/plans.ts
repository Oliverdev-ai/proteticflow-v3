// Alinhado ao PRD seção 1.5: trial (30 dias com funcionalidades pro) → starter → pro → enterprise
export const PLAN_TIER = {
  TRIAL: 'trial',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER];

export type PlanFeatureAccess = {
  reports: boolean;
  portal: boolean;
  ai: boolean | 'basic' | 'full';
  api: boolean;
};

export type PlanLimitsConfig = {
  clients: number | null;
  jobsPerMonth: number | null;
  users: number | null;
  priceTables: number | null;
  storagesMb: number | null;
  features: PlanFeatureAccess;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimitsConfig> = {
  trial: {
    clients: 10,
    jobsPerMonth: 30,
    users: 2,
    priceTables: 1,
    storagesMb: 500,
    features: { reports: false, portal: false, ai: false, api: false },
  },
  starter: {
    clients: 50,
    jobsPerMonth: 200,
    users: 5,
    priceTables: 3,
    storagesMb: 2000,
    features: { reports: true, portal: false, ai: 'basic', api: false },
  },
  pro: {
    clients: 500,
    jobsPerMonth: null,
    users: 15,
    priceTables: null,
    storagesMb: 10000,
    features: { reports: true, portal: true, ai: 'full', api: true },
  },
  enterprise: {
    clients: null,
    jobsPerMonth: null,
    users: null,
    priceTables: null,
    storagesMb: null,
    features: { reports: true, portal: true, ai: 'full', api: true },
  },
};

export type LimitableFeature = 'clients' | 'jobsPerMonth' | 'users' | 'priceTables';
