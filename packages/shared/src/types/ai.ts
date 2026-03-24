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

export interface AIFeatureFlags {
  forecasting: boolean;
  operations: boolean;
  recommendation: boolean;
  riskCommercial: boolean;
  autoExecutionEnabled: boolean;
}

export interface AIConfidenceSummary {
  score: number;
  rationale: string;
}
