import { createTRPCReact } from '@trpc/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@proteticflow/server/trpc';

function createTrpcClient() {
  return createTRPCReact<AppRouter>();
}

export const trpc: ReturnType<typeof createTrpcClient> = createTrpcClient();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});
