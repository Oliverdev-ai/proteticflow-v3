export type AiSession = {
  id: number;
  tenantId: number;
  userId: number;
  title: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type AiMessage = {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  commandDetected: string | null;
  tokensUsed?: number | null;
  createdAt: string;
};

export type AiCommand =
  | 'relatorio_ar'
  | 'fechamento_mensal'
  | 'balanco_anual'
  | 'folha_pagamento'
  | 'trabalhos_pendentes'
  | 'entregas_hoje'
  | 'cadastrar_cliente'
  | 'cadastrar_trabalho'
  | 'finalizar_trabalho'
  | 'listar_clientes'
  | 'buscar_cliente'
  | 'prever_receita'
  | 'estimar_producao'
  | 'resumo_analytics'
  | 'smart_orders'
  | 'agendar';

export type AiLabContext = {
  totalClients: number;
  jobsByStatus: Record<string, number>;
  deliveriesToday: number;
  criticalStock: number;
  overdueAr: number;
  pendingAr: number;
};

export type AIDomain = 'forecasting' | 'operations' | 'recommendation' | 'risk_commercial';

export type AIPredictionType =
  | 'revenue_forecast'
  | 'production_time_estimate'
  | 'stock_depletion_forecast'
  | 'rework_pattern'
  | 'credit_score'
  | 'dynamic_pricing';

export type AIRecommendationType =
  | 'smart_order'
  | 'schedule_optimization'
  | 'material_suggestion'
  | 'production_sequence'
  | 'collection_strategy'
  | 'price_adjustment';

export type AIRecommendationStatus = 'suggested' | 'accepted' | 'rejected' | 'dismissed';
export type AIFeedbackDecision = 'accepted' | 'rejected' | 'ignored';
export type AIModelRunStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AiPlanTier = 'trial' | 'starter' | 'pro' | 'enterprise';

export type AiPrediction = {
  id: number;
  tenantId: number;
  modelRunId: number | null;
  domain: AIDomain;
  predictionType: AIPredictionType;
  entityType: string;
  entityId: number;
  predictedValue: string;
  unit: string;
  confidenceScore: string;
  explanation: string | null;
  generatedAt: string;
  createdAt: string;
};

export type AiRecommendation = {
  id: number;
  tenantId: number;
  predictionId: number | null;
  modelRunId: number | null;
  domain: AIDomain;
  recommendationType: AIRecommendationType;
  status: AIRecommendationStatus;
  targetEntityType: string;
  targetEntityId: number;
  priorityScore: string;
  confidenceScore: string;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiModelRun = {
  id: number;
  tenantId: number;
  domain: AIDomain;
  modelName: string;
  modelVersion: string;
  status: AIModelRunStatus;
  trigger: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};
