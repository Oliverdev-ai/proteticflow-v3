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
  financial: boolean;
  voiceCommands: boolean;
};

export type PlanLimitsConfig = {
  fullAccessDays: number | null;
  labs: number | null;
  clients: number | null;
  jobsPerMonth: number | null;
  whatsappPerMonth: number | null;
  users: number | null;
  priceTables: number | null;
  managerActionsPerMonth: number | null;
  storagesMb: number | null;
  features: PlanFeatureAccess;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimitsConfig> = {
  trial: {
    fullAccessDays: 14,
    labs: 1,
    clients: 10,
    jobsPerMonth: 10,
    whatsappPerMonth: 0,
    users: 1,
    priceTables: 1,
    managerActionsPerMonth: 10,
    storagesMb: 500,
    features: {
      reports: false,
      portal: false,
      ai: false,
      api: false,
      financial: false,
      voiceCommands: false,
    },
  },
  starter: {
    fullAccessDays: 30,
    labs: 1,
    clients: 20,
    jobsPerMonth: 100,
    whatsappPerMonth: 200,
    users: 3,
    priceTables: 2,
    managerActionsPerMonth: null,
    storagesMb: 2000,
    features: {
      reports: true,
      portal: false,
      ai: 'basic',
      api: false,
      financial: true,
      voiceCommands: false,
    },
  },
  pro: {
    fullAccessDays: 30,
    labs: 3,
    clients: 50,
    jobsPerMonth: 300,
    whatsappPerMonth: 1000,
    users: 10,
    priceTables: 5,
    managerActionsPerMonth: null,
    storagesMb: 10000,
    features: {
      reports: true,
      portal: true,
      ai: 'full',
      api: true,
      financial: true,
      voiceCommands: true,
    },
  },
  enterprise: {
    fullAccessDays: null,
    labs: null,
    clients: null,
    jobsPerMonth: null,
    whatsappPerMonth: null,
    users: null,
    priceTables: null,
    managerActionsPerMonth: null,
    storagesMb: null,
    features: {
      reports: true,
      portal: true,
      ai: 'full',
      api: true,
      financial: true,
      voiceCommands: true,
    },
  },
};

export type LimitableFeature = 'labs' | 'clients' | 'jobsPerMonth' | 'users' | 'priceTables';
export type GatedFeature = keyof PlanFeatureAccess;

export type PlanAiProvider = 'gemini' | 'anthropic';

export type PlanAiConfig = {
  llmProvider: PlanAiProvider;
  llmModel: string;
  fallbackProvider: PlanAiProvider | null;
  callsPerDay: number;
  ttsEnabled: boolean;
  allowProviderOverride: boolean;
};

export const PLAN_AI_CONFIG: Record<PlanTier, PlanAiConfig> = {
  trial: {
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    fallbackProvider: null,
    callsPerDay: 10,
    ttsEnabled: true,
    allowProviderOverride: false,
  },
  starter: {
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    fallbackProvider: null,
    callsPerDay: 10,
    ttsEnabled: false,
    allowProviderOverride: false,
  },
  pro: {
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    fallbackProvider: null,
    callsPerDay: 50,
    ttsEnabled: true,
    allowProviderOverride: false,
  },
  enterprise: {
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    fallbackProvider: 'anthropic',
    callsPerDay: 100,
    ttsEnabled: true,
    allowProviderOverride: true,
  },
};
