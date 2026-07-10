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

export const ROLE_PERMISSIONS: Record<Role, { modules: string[] }> = {
  superadmin: { modules: ['*'] },
  gerente: { modules: ['dashboard', 'clients', 'jobs', 'kanban', 'financial', 'inventory',
    'employees', 'payroll', 'reports', 'scans', 'agenda', 'deliveries', 'commissions',
    'settings', 'portal', 'ai', 'fiscal'] },
  producao: { modules: ['dashboard', 'jobs', 'kanban', 'scans', 'agenda', 'inventory.consume'] },
  recepcao: { modules: ['dashboard', 'clients', 'jobs.create', 'jobs.view', 'agenda', 'deliveries', 'pricing.view'] },
  contabil: { modules: ['dashboard', 'financial', 'reports', 'payroll', 'fiscal'] },
};

const ADMIN_PROCEDURE_ROLES: ReadonlySet<Role> = new Set([ROLES.SUPERADMIN, ROLES.GERENTE]);

export function canAccessModule(role: Role | null | undefined, moduleName: string): boolean {
  const requestedModule = moduleName.trim();
  if (!role || requestedModule.length === 0) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.modules.some((allowedModule) =>
    allowedModule === '*'
    || allowedModule === requestedModule
    || requestedModule.startsWith(`${allowedModule}.`)
    || allowedModule.startsWith(`${requestedModule}.`),
  );
}

export function canUseAdminProcedure(role: Role | null | undefined): boolean {
  return Boolean(role && ADMIN_PROCEDURE_ROLES.has(role));
}
