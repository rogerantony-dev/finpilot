import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { SESSION_KEY } from '../features/auth/session';

// If any request comes back 401 (session expired or signed out elsewhere),
// clear the cached session; <RequireAuth> then redirects to the login page.
const onError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401)
    queryClient.setQueryData(SESSION_KEY, null);
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry network blips and 5xx once; a 4xx will not fix itself.
      retry: (count, error) =>
        count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});
