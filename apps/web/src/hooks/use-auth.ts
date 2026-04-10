import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const SESSION_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function useAuth() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [sessionRecoveryState, setSessionRecoveryState] = useState<'idle' | 'refreshing' | 'failed'>(
    'idle',
  );

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
  const refreshSessionMutation = trpc.auth.refresh.useMutation();

  useEffect(() => {
    if (isAuthenticated && sessionRecoveryState !== 'idle') {
      setSessionRecoveryState('idle');
    }
  }, [isAuthenticated, sessionRecoveryState]);

  useEffect(() => {
    if (!isUnauthorized || sessionRecoveryState !== 'idle' || refreshSessionMutation.isPending) {
      return;
    }

    let active = true;
    setSessionRecoveryState('refreshing');

    void refreshSessionMutation
      .mutateAsync()
      .then(async () => {
        await Promise.all([
          utils.auth.getProfile.invalidate(),
          utils.auth.getPermissions.invalidate(),
        ]);

        if (active) {
          setSessionRecoveryState('idle');
        }
      })
      .catch(() => {
        if (active) {
          setSessionRecoveryState('failed');
        }
      });

    return () => {
      active = false;
    };
  }, [
    isUnauthorized,
    refreshSessionMutation,
    sessionRecoveryState,
    utils.auth.getPermissions,
    utils.auth.getProfile,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (refreshSessionMutation.isPending) {
        return;
      }

      void refreshSessionMutation
        .mutateAsync()
        .then(async () => {
          await Promise.all([
            utils.auth.getProfile.invalidate(),
            utils.auth.getPermissions.invalidate(),
          ]);
        })
        .catch(() => {
          // Se o refresh periódico falhar, mantemos a sessão atual até a próxima verificação protegida.
        });
    }, SESSION_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, refreshSessionMutation, utils.auth.getPermissions, utils.auth.getProfile]);

  const isAuthPending =
    isLoading ||
    isFetching ||
    (isUnauthorized && sessionRecoveryState !== 'failed') ||
    sessionRecoveryState === 'refreshing';
  const isAuthResolved = useMemo(
    () => isAuthenticated || (isUnauthorized && sessionRecoveryState === 'failed'),
    [isAuthenticated, isUnauthorized, sessionRecoveryState],
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
    isAuthPending,
    isAuthResolved,
    isAuthenticated,
    isError: !!error && !isUnauthorized,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    updateProfile: updateProfileMutation,
  };
}
