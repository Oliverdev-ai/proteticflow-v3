import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';

export function useAuth() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: profile, isLoading, isFetching, error } = trpc.auth.getProfile.useQuery(undefined, {
    retry(failureCount, queryError) {
      if (queryError.data?.code === 'UNAUTHORIZED') {
        return false;
      }

      return failureCount < 2;
    },
    refetchOnWindowFocus: true,
  });

  const isUnauthorized = error?.data?.code === 'UNAUTHORIZED';
  const isAuthenticated = Boolean(profile);
  const isAuthResolved = useMemo(
    () => isAuthenticated || isUnauthorized,
    [isAuthenticated, isUnauthorized],
  );

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.getProfile.invalidate();
      navigate('/');
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.getProfile.invalidate();
      navigate('/login');
    },
  });

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.getProfile.invalidate();
    },
  });

  return {
    user: profile,
    isLoading,
    isFetching,
    isAuthResolved,
    isAuthenticated,
    isError: !!error && !isUnauthorized,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    updateProfile: updateProfileMutation,
  };
}
