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
