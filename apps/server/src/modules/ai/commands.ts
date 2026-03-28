import type { AiCommand, Role } from '@proteticflow/shared';

export const COMMAND_RBAC: Record<AiCommand, Role[]> = {
  relatorio_ar: ['superadmin', 'gerente', 'contabil'],
  fechamento_mensal: ['superadmin', 'gerente', 'contabil'],
  balanco_anual: ['superadmin', 'gerente', 'contabil'],
  folha_pagamento: ['superadmin', 'gerente', 'contabil'],
  prever_receita: ['superadmin', 'gerente', 'contabil'],
  resumo_analytics: ['superadmin', 'gerente', 'contabil'],
  smart_orders: ['superadmin', 'gerente', 'contabil'],
  trabalhos_pendentes: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
  entregas_hoje: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
  cadastrar_cliente: ['superadmin', 'gerente', 'recepcao'],
  cadastrar_trabalho: ['superadmin', 'gerente', 'recepcao'],
  finalizar_trabalho: ['superadmin', 'gerente', 'producao'],
  listar_clientes: ['superadmin', 'gerente', 'recepcao', 'producao', 'contabil'],
  buscar_cliente: ['superadmin', 'gerente', 'recepcao', 'producao', 'contabil'],
  estimar_producao: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
  agendar: ['superadmin', 'gerente', 'producao', 'recepcao', 'contabil'],
};

export const COMMAND_PATTERNS: Array<{ command: AiCommand; patterns: RegExp[] }> = [
  { command: 'relatorio_ar', patterns: [/contas? a receber/i, /relatorio.*receber/i] },
  { command: 'fechamento_mensal', patterns: [/fechamento (mensal|do mes)/i, /fechar (o )?mes/i] },
  { command: 'balanco_anual', patterns: [/balanco anual/i, /relatorio anual/i] },
  { command: 'folha_pagamento', patterns: [/folha de pagamento/i, /ger(ar|e) folha/i] },
  { command: 'trabalhos_pendentes', patterns: [/trabalhos? (pendentes?|em aberto)/i, /listar trabalhos/i] },
  { command: 'entregas_hoje', patterns: [/entregas? (de hoje|para hoje)/i, /listar entregas/i] },
  { command: 'cadastrar_cliente', patterns: [/cadastrar cliente/i, /novo cliente/i] },
  { command: 'cadastrar_trabalho', patterns: [/cadastrar trabalho/i, /nova os/i, /novo trabalho/i] },
  { command: 'finalizar_trabalho', patterns: [/finalizar trabalho/i, /concluir trabalho/i, /entregar os/i] },
  { command: 'listar_clientes', patterns: [/listar clientes/i, /lista de clientes/i] },
  { command: 'buscar_cliente', patterns: [/buscar cliente/i, /encontrar cliente/i] },
  { command: 'prever_receita', patterns: [/prev[eê] receita/i, /projecao de receita/i] },
  { command: 'estimar_producao', patterns: [/estimar producao/i, /estimativa de producao/i] },
  { command: 'resumo_analytics', patterns: [/resumo anal[ií]tico/i, /kpis? do mes/i] },
  { command: 'smart_orders', patterns: [/smart orders/i, /pedido inteligente/i] },
  { command: 'agendar', patterns: [/agendar/i, /marcar (prova|reuniao|entrega)/i] },
];

// RBAC de comandos e intencionalmente feito aqui no engine:
// qualquer usuario pode conversar livremente, mas comandos sensiveis
// sao bloqueados silenciosamente retornando null.
export function detectCommand(content: string, userRole: Role): AiCommand | null {
  for (const { command, patterns } of COMMAND_PATTERNS) {
    if (!patterns.some((pattern) => pattern.test(content))) {
      continue;
    }
    if (COMMAND_RBAC[command].includes(userRole)) {
      return command;
    }
    return null;
  }
  return null;
}
