import { trpc } from '../lib/trpc';
import { ROLE_PERMISSIONS } from '@proteticflow/shared';
import type { Role } from '@proteticflow/shared';

export function usePermissions() {
  const { data: profile } = trpc.auth.getProfile.useQuery();

  // Role vem do tenant_members via context (não do users.role global)
  const role = (profile?.role ?? 'recepcao') as Role;
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.recepcao;

  const hasAccess = (module: string): boolean => {
    if (permissions.modules.includes('*' as never)) return true;
    return permissions.modules.some((m: string) =>
      m === module || module.startsWith(m + '.') || m.startsWith(module + '.')
    );
  };

  return { role, modules: permissions.modules, hasAccess };
}
