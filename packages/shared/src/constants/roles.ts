// Valores conforme PRD v3_DEFINITIVO seção 1.4 (superadmin→gerente→producao→recepcao→contabil)
export const ROLES = {
  SUPERADMIN: 'superadmin',  // operador global do SaaS (cross-tenant)
  GERENTE: 'gerente',        // acesso total ao tenant (ex-owner/admin)
  PRODUCAO: 'producao',      // linha de produção (jobs, kanban, estoque.consumir)
  RECEPCAO: 'recepcao',      // recepção (clientes, OS view/create, entregas)
  CONTABIL: 'contabil',      // contábil (financeiro, relatórios)
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Administrador',
  gerente: 'Gerente',
  producao: 'Linha de Produção',
  recepcao: 'Recepção',
  contabil: 'Contábil',
};
