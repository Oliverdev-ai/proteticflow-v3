import { trpc } from '../lib/trpc';

export function useTenant() {
  const { data: list, isLoading } = trpc.tenant.list.useQuery();
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const switchMutation = trpc.tenant.switchTenant.useMutation();
  const utils = trpc.useUtils();

  const current = list?.find((t) => t.id === profile?.activeTenantId) ?? list?.[0] ?? null;

  const switchTenant = (tenantId: number) => {
    switchMutation.mutate(
      { tenantId },
      {
        onSuccess: () => {
          utils.auth.getProfile.invalidate();
          utils.auth.getPermissions.invalidate();
          utils.tenant.list.invalidate();
        },
      },
    );
  };

  return { current, list, isLoading, switchTenant };
}

