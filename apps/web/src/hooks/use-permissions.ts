import { trpc } from '../lib/trpc';
import { useTenant } from './use-tenant';
import { ROLE_PERMISSIONS, canAccessModule } from '@proteticflow/shared';
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
    return canAccessModule(role, module);
  };

  return { role, modules: permissions.modules, hasAccess, isLoading };
}

