import { trpc } from '../lib/trpc';
import { useTenant } from './use-tenant';
import { ROLE_PERMISSIONS } from '@proteticflow/shared';
import type { Role } from '@proteticflow/shared';

export function usePermissions() {
  const { current } = useTenant();
  const { data, isLoading } = trpc.auth.getPermissions.useQuery(
    current?.id ? { tenantId: current.id } : undefined,
    { enabled: !!current?.id }
  );
  const role = (data?.role ?? 'recepcao') as Role;
  const permissions = data ?? (ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.recepcao);

  const hasAccess = (module: string): boolean => {
    if (permissions.modules.includes('*' as never)) return true;
    return permissions.modules.some(
      (m: string) => m === module || module.startsWith(m + '.') || m.startsWith(module + '.'),
    );
  };

  return { role, modules: permissions.modules, hasAccess, isLoading };
}

