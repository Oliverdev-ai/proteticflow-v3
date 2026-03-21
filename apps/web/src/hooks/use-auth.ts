import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc.js';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const navigate = useNavigate();

  const utils = trpc.useUtils();
  
  const { data: profile, isLoading, error } = trpc.auth.getProfile.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profile) {
      setIsAuthenticated(true);
    } else if (error?.data?.code === 'UNAUTHORIZED') {
      setIsAuthenticated(false);
      navigate('/login');
    }
  }, [profile, error, navigate]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setIsAuthenticated(true);
      utils.auth.getProfile.invalidate();
      navigate('/');
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setIsAuthenticated(false);
      utils.auth.getProfile.invalidate();
      navigate('/login');
    }
  });

  return {
    user: profile,
    isLoading,
    isAuthenticated,
    isError: !!error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
  };
}
